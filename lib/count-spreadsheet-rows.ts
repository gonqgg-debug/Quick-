/** Client-safe row count for the import drop zone, before the file is uploaded. */

export async function countSpreadsheetDataRows(file: File): Promise<number | null> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const rows = text.split(/\r?\n/).filter((line) => line.trim());
    return Math.max(0, rows.length - 1);
  }
  if (!name.endsWith(".xlsx")) {
    return null;
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const xml = await firstSheetXml(bytes);
    const rows = xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/gi) ?? [];
    const nonempty = rows.filter((row) => /<v\b|<t\b|<is\b/i.test(row));
    return Math.max(0, nonempty.length - 1);
  } catch {
    return null;
  }
}

async function firstSheetXml(buffer: Uint8Array): Promise<string> {
  const files = await unzip(buffer);
  const workbook = files.get("xl/workbook.xml");
  if (!workbook) {
    throw new Error("workbook");
  }
  const rels = files.get("xl/_rels/workbook.xml.rels") ?? "";
  const sheetPath = firstSheetPath(workbook, rels);
  const sheet = files.get(sheetPath) ?? files.get(sheetPath.replace(/^xl\//, ""));
  if (!sheet) {
    throw new Error("sheet");
  }
  return sheet;
}

function firstSheetPath(workbookXml: string, relsXml: string): string {
  const sheetMatch =
    workbookXml.match(/<sheet\b[^>]*\br:id="([^"]+)"/i) ?? workbookXml.match(/<sheet\b[^>]*\bid="([^"]+)"/i);
  const rId = sheetMatch?.[1];
  if (rId && relsXml) {
    const rel =
      new RegExp(`<Relationship\\b[^>]*\\bId="${escapeRegExp(rId)}"[^>]*\\bTarget="([^"]+)"`, "i").exec(relsXml) ??
      new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${escapeRegExp(rId)}"`, "i").exec(relsXml);
    if (rel?.[1]) {
      const target = rel[1].replace(/^\//, "");
      return target.startsWith("xl/") ? target : `xl/${target}`;
    }
  }
  return "xl/worksheets/sheet1.xml";
}

async function unzip(buffer: Uint8Array): Promise<Map<string, string>> {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const files = new Map<string, string>();
  let offset = 0;
  const decoder = new TextDecoder("utf-8");
  while (offset + 30 <= buffer.length) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50 || signature === 0x06064b50) {
      break;
    }
    if (signature !== 0x04034b50) {
      throw new Error("zip");
    }
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    let compressed = view.getUint32(offset + 18, true);
    const nameStart = offset + 30;
    const name = decoder.decode(buffer.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (flags & 0x8) {
      compressed = findCompressedSize(view, buffer.length, dataStart);
    }
    const data = buffer.subarray(dataStart, dataStart + compressed);
    let out: Uint8Array;
    if (method === 0) {
      out = data;
    } else if (method === 8) {
      out = await inflateRaw(data);
    } else {
      throw new Error("method");
    }
    if (name.endsWith(".xml")) {
      files.set(name, decoder.decode(out));
    }
    offset = dataStart + compressed;
    if (flags & 0x8) {
      offset += view.getUint32(offset, true) === 0x08074b50 ? 16 : 12;
    }
  }
  return files;
}

function findCompressedSize(view: DataView, length: number, dataStart: number): number {
  for (let i = dataStart; i + 16 <= length; i += 1) {
    const maybeSig = view.getUint32(i, true);
    if (maybeSig === 0x08074b50) {
      return i - dataStart;
    }
    if (maybeSig === 0x04034b50 || maybeSig === 0x02014b50) {
      const descriptor = i - 12;
      if (descriptor >= dataStart) {
        return descriptor - dataStart;
      }
    }
  }
  throw new Error("descriptor");
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
