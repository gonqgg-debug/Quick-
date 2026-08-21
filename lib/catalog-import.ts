import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice, toMoney } from "@/lib/money";
import { normalizeBarcode } from "@/lib/barcode";
import { parseSpreadsheet } from "@/lib/read-spreadsheet";
import type {
  FieldChange,
  ImportField,
  ImportInvalidItem,
  ImportMissingItem,
  ImportNewItem,
  ImportPreview,
  ImportRow,
  ImportUnchangedItem,
  ImportUpdateItem,
} from "@/lib/catalog-import-shared";

export type {
  FieldChange,
  ImportField,
  ImportInvalidItem,
  ImportMissingItem,
  ImportNewItem,
  ImportPreview,
  ImportRow,
  ImportUnchangedItem,
  ImportUpdateItem,
} from "@/lib/catalog-import-shared";

export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;

type DbProduct = {
  id: string;
  codigo_odoo: string | null;
  codigo_barras: string | null;
  nombre: string;
  marca: string | null;
  categoria: string;
  precio: number;
};

const HEADER_ALIASES: Record<"codigo" | ImportField, string[]> = {
  codigo: [
    "codigo",
    "codigo odoo",
    "codigo_odoo",
    "codigo interno",
    "referencia interna",
    "referencia",
    "default code",
    "default_code",
    "internal reference",
    "sku",
  ],
  nombre: ["nombre", "name", "producto", "product", "product name", "nombre del producto", "nombre producto"],
  marca: [
    "marca",
    "marca del producto",
    "marca producto",
    "product brand",
    "brand",
    "fabricante",
    "manufacturer",
  ],
  categoria: [
    "pos product category",
    "categoria pos",
    "categoria de punto de venta",
    "product category",
    "categoria del producto",
    "categoria de producto",
    "categoria producto",
    "internal category",
    "categ id complete name",
    "categ id",
    "categoria",
    "category",
    "categ",
  ],
  precio: [
    "precio",
    "price",
    "list price",
    "precio de venta",
    "sales price",
    "pvp",
    "precio venta",
    "lst_price",
    "list_price",
  ],
  codigoBarras: [
    "codigo de barras",
    "codigo barras",
    "barcode",
    "ean",
    "ean13",
    "gtin",
    "upc",
  ],
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headerScore(header: string, aliases: string[]): number {
  let best = 0;
  for (const alias of aliases) {
    if (header === alias) {
      best = Math.max(best, 200 + alias.length);
      continue;
    }
    if (alias.includes(" ") && (header.startsWith(`${alias} `) || header.endsWith(` ${alias}`) || header.includes(` ${alias} `))) {
      best = Math.max(best, 80 + alias.length);
    }
  }
  return best;
}

function mapHeaders(headerRow: string[]): Partial<Record<"codigo" | ImportField, number>> {
  const map: Partial<Record<"codigo" | ImportField, number>> = {};
  const used = new Set<number>();
  const fields = Object.keys(HEADER_ALIASES) as Array<"codigo" | ImportField>;
  for (const field of fields) {
    let bestIndex = -1;
    let bestScore = 0;
    headerRow.forEach((raw, index) => {
      if (used.has(index)) {
        return;
      }
      const score = headerScore(normalizeHeader(raw), HEADER_ALIASES[field]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      map[field] = bestIndex;
      used.add(bestIndex);
    }
  }
  return map;
}

function categoryColumnIndexes(headerRow: string[], reserved: Set<number>): number[] {
  const indexes: number[] = [];
  headerRow.forEach((raw, index) => {
    if (reserved.has(index)) {
      return;
    }
    if (headerScore(normalizeHeader(raw), HEADER_ALIASES.categoria) > 0) {
      indexes.push(index);
    }
  });
  return indexes;
}

function marcaColumnIndexes(headerRow: string[], reserved: Set<number>): number[] {
  const indexes: number[] = [];
  headerRow.forEach((raw, index) => {
    if (reserved.has(index)) {
      return;
    }
    if (headerScore(normalizeHeader(raw), HEADER_ALIASES.marca) > 0) {
      indexes.push(index);
    }
  });
  return indexes;
}

function isGenericCategory(value: string): boolean {
  return /^(all|todos|all products|todos los productos|saleable)$/i.test(value.trim());
}

function tidyCategory(value: string): string {
  const parts = value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isGenericCategory(part));
  return parts[parts.length - 1] ?? "";
}

function pickCategory(raw: string[], indexes: number[], fallback: string | null): string {
  const values = indexes.map((index) => tidyCategory(cell(raw, index))).filter(Boolean);
  return values.find((value) => value.length > 0) || fallback || "";
}

function pickMarca(raw: string[], indexes: number[], fallback: string | null): string | null {
  for (const index of indexes) {
    const value = textOrNull(cell(raw, index));
    if (value) {
      return value;
    }
  }
  return fallback;
}

export function parsePrice(raw: string): number | null {
  let value = raw.trim();
  if (!value) {
    return null;
  }
  value = value.replace(/rd\$|dop|usd/gi, "").replace(/\$/g, "").trim();
  value = value.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) {
    value = value.replace(/,/g, "");
  } else if (/^\d+,\d{1,2}$/.test(value)) {
    value = value.replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

function moneyEqual(left: number, right: number): boolean {
  return Math.round(toMoney(left) * 100) === Math.round(toMoney(right) * 100);
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cell(row: string[], index: number | undefined): string {
  if (index == null) {
    return "";
  }
  return String(row[index] ?? "").trim();
}

function currentMarcaForCode(byCode: Map<string, DbProduct>, codigo: string): string | null {
  return byCode.get(codigo)?.marca ?? null;
}

export async function fetchImportProducts(supabase: SupabaseClient): Promise<DbProduct[]> {
  const products: DbProduct[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 50_000; from += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, codigo_odoo, codigo_barras, nombre, marca, categoria, precio")
      .order("nombre", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      throw error;
    }
    const batch = (data ?? []) as DbProduct[];
    products.push(
      ...batch.map((row) => ({
        ...row,
        precio: toMoney(row.precio),
        marca: row.marca ? String(row.marca) : null,
        codigo_odoo: row.codigo_odoo ? String(row.codigo_odoo).trim() : null,
        codigo_barras: row.codigo_barras ? String(row.codigo_barras).trim() : null,
      }))
    );
    if (batch.length < pageSize) {
      break;
    }
  }
  return products;
}

export function buildImportPreview(buffer: Buffer, fileName: string, existing: DbProduct[]): ImportPreview {
  const table = parseSpreadsheet(buffer, fileName);
  if (table.length < 2) {
    throw new Error("El archivo no tiene filas de productos");
  }
  const headerIndex = table.findIndex((row) => row.some((value) => value.trim()));
  if (headerIndex < 0) {
    throw new Error("El archivo está vacío");
  }
  const headers = table[headerIndex];
  const columns = mapHeaders(headers);
  if (columns.codigo == null || columns.nombre == null || columns.precio == null) {
    throw new Error(
      "No encontramos las columnas de código, nombre y precio. Revisa que el Excel traiga código Odoo, nombre y precio."
    );
  }
  const reserved = new Set(
    ([columns.codigo, columns.nombre, columns.precio, columns.codigoBarras].filter((index) => index != null) as number[])
  );
  const categoryIndexes = categoryColumnIndexes(headers, reserved);
  const brandIndexes = marcaColumnIndexes(headers, reserved);

  const byCode = new Map<string, DbProduct>();
  for (const product of existing) {
    if (product.codigo_odoo) {
      byCode.set(product.codigo_odoo, product);
    }
  }

  const created: ImportNewItem[] = [];
  const updated: ImportUpdateItem[] = [];
  const unchanged: ImportUnchangedItem[] = [];
  const invalid: ImportInvalidItem[] = [];
  const seen = new Set<string>();
  const fileCodes = new Set<string>();

  table.slice(headerIndex + 1).forEach((raw, offset) => {
    const rowNumber = headerIndex + offset + 2;
    if (!raw.some((value) => String(value ?? "").trim())) {
      return;
    }
    const codigo = cell(raw, columns.codigo);
    const nombre = cell(raw, columns.nombre);
    const precioRaw = cell(raw, columns.precio);
    const precio = parsePrice(precioRaw);

    if (!codigo) {
      invalid.push({ row: rowNumber, codigo: "", reason: "Falta el código Odoo" });
      return;
    }
    if (seen.has(codigo)) {
      invalid.push({ row: rowNumber, codigo, reason: "Código repetido en el archivo" });
      return;
    }
    seen.add(codigo);
    fileCodes.add(codigo);

    if (!nombre) {
      invalid.push({ row: rowNumber, codigo, reason: "Falta el nombre" });
      return;
    }
    if (precio == null) {
      invalid.push({ row: rowNumber, codigo, reason: `Precio inválido (${precioRaw || "vacío"})` });
      return;
    }

    const current = byCode.get(codigo);
    const marca = pickMarca(raw, brandIndexes, current?.marca ?? currentMarcaForCode(byCode, codigo));
    let categoria = pickCategory(raw, categoryIndexes, current?.categoria ?? null);
    if (current?.categoria && !isGenericCategory(current.categoria) && isGenericCategory(categoria)) {
      categoria = current.categoria;
    }
    if (!categoria) {
      invalid.push({ row: rowNumber, codigo, reason: "Falta la categoría" });
      return;
    }

    const incoming: ImportRow = {
      codigo,
      nombre,
      marca,
      categoria,
      precio,
      codigoBarras:
        normalizeBarcode(cell(raw, columns.codigoBarras)) ||
        normalizeBarcode(codigo) ||
        current?.codigo_barras ||
        null,
    };
    if (!current) {
      created.push(incoming);
      return;
    }

    const changes: FieldChange[] = [];
    if (current.nombre !== nombre) {
      changes.push({
        field: "nombre",
        from: current.nombre,
        to: nombre,
        fromLabel: current.nombre,
        toLabel: nombre,
      });
    }
    const currentMarca = current.marca || null;
    if (currentMarca !== marca) {
      changes.push({
        field: "marca",
        from: currentMarca,
        to: marca,
        fromLabel: currentMarca || "—",
        toLabel: marca || "—",
      });
    }
    if (incoming.codigoBarras && incoming.codigoBarras !== current.codigo_barras) {
      changes.push({
        field: "codigoBarras",
        from: current.codigo_barras,
        to: incoming.codigoBarras,
        fromLabel: current.codigo_barras || "—",
        toLabel: incoming.codigoBarras,
      });
    }
    if (current.categoria !== categoria) {
      changes.push({
        field: "categoria",
        from: current.categoria,
        to: categoria,
        fromLabel: current.categoria,
        toLabel: categoria,
      });
    }
    if (!moneyEqual(current.precio, precio)) {
      changes.push({
        field: "precio",
        from: current.precio,
        to: precio,
        fromLabel: formatPrice(current.precio),
        toLabel: formatPrice(precio),
      });
    }

    if (changes.length === 0) {
      unchanged.push({ codigo, nombre });
      return;
    }
    updated.push({ ...incoming, id: current.id, changes });
  });

  const missing: ImportMissingItem[] = existing
    .filter((product) => !product.codigo_odoo || !fileCodes.has(product.codigo_odoo))
    .map((product) => ({
      id: product.id,
      codigo: product.codigo_odoo,
      nombre: product.nombre,
    }));

  const columnLabels: ImportPreview["columns"] = {};
  (Object.keys(columns) as Array<"codigo" | ImportField>).forEach((field) => {
    const index = columns[field];
    if (index != null) {
      columnLabels[field] = headers[index] || field;
    }
  });

  return {
    fileName,
    columns: columnLabels,
    totals: {
      rows: created.length + updated.length + unchanged.length + invalid.length,
      created: created.length,
      updated: updated.length,
      unchanged: unchanged.length,
      invalid: invalid.length,
      missing: missing.length,
    },
    created,
    updated,
    unchanged,
    invalid,
    missing,
  };
}

export async function applyImportPreview(
  supabase: SupabaseClient,
  preview: ImportPreview
): Promise<{ created: number; updated: number; unchanged: number; missing: number }> {
  const rows = [...preview.created, ...preview.updated].map((item) => ({
    codigo_odoo: item.codigo,
    nombre: item.nombre,
    marca: item.marca,
    categoria: item.categoria,
    precio: item.precio,
    ...(item.codigoBarras ? { codigo_barras: item.codigoBarras } : {}),
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from("products").upsert(batch, { onConflict: "codigo_odoo" });
    if (error) {
      throw error;
    }
  }

  return {
    created: preview.created.length,
    updated: preview.updated.length,
    unchanged: preview.unchanged.length,
    missing: preview.missing.length,
  };
}
