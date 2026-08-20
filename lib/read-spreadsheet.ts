import { inflateRawSync } from "node:zlib";

const MAX_ROWS = 20_000;
const MAX_COLS = 40;

export function parseSpreadsheet(buffer: Buffer, filename: string): string[][] {
  const name = filename.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(buffer.toString("utf8"));
  }
  if (name.endsWith(".xlsx")) {
    return parseXlsx(buffer);
  }
  throw new Error("Sube un archivo .xlsx o .csv");
}

function parseCsv(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = text.split("\n").find((line) => line.trim()) ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field.trim());
      field = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      if (rows.length > MAX_ROWS) {
        throw new Error("El archivo tiene demasiadas filas");
      }
      continue;
    }
    field += ch;
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(line: string): string {
  const counts = {
    ",": (line.match(/,/g) ?? []).length,
    ";": (line.match(/;/g) ?? []).length,
    "\t": (line.match(/\t/g) ?? []).length,
  };
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) {
    return ";";
  }
  if (counts["\t"] > counts[","] && counts["\t"] >= counts[";"]) {
    return "\t";
  }
  return ",";
}

function parseXlsx(buffer: Buffer): string[][] {
  const files = unzip(buffer);
  const workbook = files.get("xl/workbook.xml");
  if (!workbook) {
    throw new Error("El Excel no tiene libro (workbook.xml)");
  }
  const rels = files.get("xl/_rels/workbook.xml.rels");
  const sheetPath = firstSheetPath(workbook.toString("utf8"), rels?.toString("utf8") ?? "");
  const sheet = files.get(sheetPath) ?? files.get(sheetPath.replace(/^xl\//, ""));
  if (!sheet) {
    throw new Error("No pudimos leer la hoja del Excel");
  }
  const shared = files.get("xl/sharedStrings.xml");
  const strings = shared ? parseSharedStrings(shared.toString("utf8")) : [];
  return parseSheet(sheet.toString("utf8"), strings);
}

function firstSheetPath(workbookXml: string, relsXml: string): string {
  const sheetMatch = workbookXml.match(/<sheet\b[^>]*\br:id="([^"]+)"/i) ?? workbookXml.match(/<sheet\b[^>]*\bid="([^"]+)"/i);
  const rId = sheetMatch?.[1];
  if (rId && relsXml) {
    const rel = new RegExp(`<Relationship\\b[^>]*\\bId="${escapeRegExp(rId)}"[^>]*\\bTarget="([^"]+)"`, "i").exec(relsXml)
      ?? new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${escapeRegExp(rId)}"`, "i").exec(relsXml);
    if (rel?.[1]) {
      const target = rel[1].replace(/^\//, "");
      return target.startsWith("xl/") ? target : `xl/${target}`;
    }
  }
  return "xl/worksheets/sheet1.xml";
}

function parseSharedStrings(xml: string): string[] {
  const items = xml.match(/<si\b[\s\S]*?<\/si>/gi) ?? [];
  return items.map((item) => {
    const parts = item.match(/<t\b[^>]*>([\s\S]*?)<\/t>/gi) ?? [];
    return parts.map((part) => decodeXml(part.replace(/<\/?t\b[^>]*>/gi, ""))).join("");
  });
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowMatches = xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/gi) ?? [];
  for (const rowXml of rowMatches) {
    if (rows.length >= MAX_ROWS) {
      throw new Error("El archivo tiene demasiadas filas");
    }
    const cells = rowXml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/gi) ?? [];
    const values: string[] = [];
    for (const cellXml of cells) {
      const ref = / r="([A-Z]+[0-9]+)"/i.exec(cellXml)?.[1];
      if (!ref) {
        continue;
      }
      const col = columnIndex(ref);
      if (col < 0 || col >= MAX_COLS) {
        continue;
      }
      while (values.length <= col) {
        values.push("");
      }
      values[col] = cellValue(cellXml, shared);
    }
    if (values.some((value) => value !== "")) {
      rows.push(values);
    }
  }
  return rows;
}

function cellValue(cellXml: string, shared: string[]): string {
  const type = / t="([^"]+)"/.exec(cellXml)?.[1] ?? "";
  if (type === "inlineStr") {
    const text = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/i)?.[1] ?? "";
    return decodeXml(text).trim();
  }
  const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "";
  const value = decodeXml(raw).trim();
  if (type === "s") {
    const index = Number(value);
    return Number.isInteger(index) && shared[index] != null ? String(shared[index]).trim() : "";
  }
  if (type === "b") {
    return value === "1" ? "TRUE" : "FALSE";
  }
  return value;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unzip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50 || signature === 0x06064b50) {
      break;
    }
    if (signature !== 0x04034b50) {
      throw new Error("El Excel está dañado o no es un .xlsx válido");
    }
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    let compressed = buffer.readUInt32LE(offset + 18);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLen).toString("utf8");
    const dataStart = nameStart + nameLen + extraLen;
    if (flags & 0x8) {
      compressed = findCompressedSize(buffer, dataStart);
    }
    const data = buffer.subarray(dataStart, dataStart + compressed);
    let out: Buffer;
    if (method === 0) {
      out = Buffer.from(data);
    } else if (method === 8) {
      out = inflateRawSync(data);
    } else {
      throw new Error("Este Excel usa una compresión que no soportamos");
    }
    files.set(name, out);
    offset = dataStart + compressed;
    if (flags & 0x8) {
      offset += buffer.readUInt32LE(offset) === 0x08074b50 ? 16 : 12;
    }
  }
  return files;
}

function findCompressedSize(buffer: Buffer, dataStart: number): number {
  for (let i = dataStart; i + 16 <= buffer.length; i += 1) {
    const maybeSig = buffer.readUInt32LE(i);
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
  throw new Error("No pudimos leer el Excel (descriptor de ZIP)");
}
