import { publishAgentEvent } from "@/lib/agent-events";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { toMoney } from "@/lib/money";
import { parsePrice } from "@/lib/catalog-import";
import { FACTURA_PRESENTACIONES, labelOf } from "@/lib/facturas-shared";
import type {
  AdminCatalogCompra,
  AdminCatalogConteos,
  AdminCatalogPresentacion,
  AdminCatalogProduct,
  AdminCatalogProductDetalle,
  AdminCatalogProductFilters,
  AdminCatalogProductList,
  AdminCatalogProveedor,
  CatalogoEstado,
  CostoManualFuente,
} from "@/lib/admin-catalog-products-shared";
import {
  CATALOG_PRODUCTS_PAGE_SIZE,
  elegirCosto,
  etiquetaCostoFuente,
  isUncategorized,
  margenDe,
  recorteDescripcion,
} from "@/lib/admin-catalog-products-shared";

export { CATALOG_PRODUCTS_PAGE_SIZE } from "@/lib/admin-catalog-products-shared";
export type {
  AdminCatalogCompra,
  AdminCatalogConteos,
  AdminCatalogPresentacion,
  AdminCatalogProduct,
  AdminCatalogProductDetalle,
  AdminCatalogProductFilters,
  AdminCatalogProductList,
  AdminCatalogProveedor,
  CatalogoEstado,
} from "@/lib/admin-catalog-products-shared";

const SELECT_FIELDS =
  "id, nombre, descripcion, marca, categoria, precio, codigo_odoo, codigo_barras, foto_url, activo, costo_manual, costo_manual_fuente, costo_manual_en";
const EXPORT_MAX = 5000;
const BATCH_MAX = 2000;
const IDS_MAX = 2000;
const NOT_IN_MAX = 80;
const COSTO_CHUNK = 100;

type QueryResult = { data: unknown[] | null; error: { message?: string } | null; count: number | null };

type FilterQuery = PromiseLike<QueryResult> & {
  or: (value: string) => FilterQuery;
  eq: (column: string, value: unknown) => FilterQuery;
  not: (column: string, op: string, value: string) => FilterQuery;
  in: (column: string, values: readonly string[]) => FilterQuery;
  order: (column: string, options: { ascending: boolean }) => FilterQuery;
  range: (from: number, to: number) => FilterQuery;
};

function asQuery(query: unknown): FilterQuery {
  return query as FilterQuery;
}

type ProductRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  categoria: string;
  precio: number | string;
  codigo_odoo: string | null;
  codigo_barras: string | null;
  foto_url: string | null;
  activo: boolean;
  costo_manual: number | string | null;
  costo_manual_fuente: string | null;
  costo_manual_en: string | null;
};

type LineaCompra = {
  productoId: string;
  facturaId: string;
  fecha: string;
  instante: string;
  costo: number | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
};

type ResumenProducto = {
  costo: number | null;
  costoEn: string | null;
  costoClave: string | null;
  proveedores: AdminCatalogProveedor[];
  compra: AdminCatalogCompra | null;
};

function sanitizeSearch(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function num(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function uno<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function fuenteManual(value: unknown): CostoManualFuente | null {
  return value === "odoo" || value === "admin" ? value : null;
}

function vacioComercial(): Pick<
  AdminCatalogProduct,
  | "costo"
  | "costoEn"
  | "costoFuente"
  | "costoFactura"
  | "costoFacturaEn"
  | "costoFacturaClave"
  | "costoManual"
  | "costoManualEn"
  | "costoManualFuente"
  | "margen"
  | "proveedores"
> {
  return {
    costo: null,
    costoEn: null,
    costoFuente: null,
    costoFactura: null,
    costoFacturaEn: null,
    costoFacturaClave: null,
    costoManual: null,
    costoManualEn: null,
    costoManualFuente: null,
    margen: null,
    proveedores: [],
  };
}

function mapRow(row: ProductRow): AdminCatalogProduct {
  const precio = toMoney(row.precio);
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    descripcion: text(row.descripcion),
    marca: row.marca ? String(row.marca) : null,
    categoria: String(row.categoria ?? ""),
    precio,
    codigoOdoo: row.codigo_odoo ? String(row.codigo_odoo) : null,
    codigoBarras: row.codigo_barras ? String(row.codigo_barras) : null,
    fotoUrl: row.foto_url ? String(row.foto_url) : null,
    activo: Boolean(row.activo),
    ...vacioComercial(),
    costoManual: num(row.costo_manual),
    costoManualEn: text(row.costo_manual_en),
    costoManualFuente: fuenteManual(row.costo_manual_fuente),
  };
}

function aplicarResumen(product: AdminCatalogProduct, resumen: ResumenProducto | undefined): AdminCatalogProduct {
  const facturaCosto = resumen?.costo ?? null;
  const elegido = elegirCosto({
    facturaCosto,
    facturaEn: resumen?.costoClave ?? resumen?.costoEn ?? null,
    manualCosto: product.costoManual,
    manualEn: product.costoManualEn,
    manualFuente: product.costoManualFuente,
  });
  const costoEn = elegido.en ? elegido.en.slice(0, 10) : null;
  return {
    ...product,
    costo: elegido.costo,
    costoEn,
    costoFuente: elegido.fuente,
    costoFactura: facturaCosto,
    costoFacturaEn: resumen?.costoEn ?? null,
    costoFacturaClave: resumen?.costoClave ?? null,
    margen: margenDe(product.precio, elegido.costo),
    proveedores: resumen?.proveedores ?? [],
  };
}

export function parseCatalogProductFilters(params: URLSearchParams): AdminCatalogProductFilters {
  const estadoRaw = params.get("estado");
  const pageRaw = Number(params.get("page") || "1");
  const estado: CatalogoEstado =
    estadoRaw === "activo" || estadoRaw === "inactivo" || estadoRaw === "sin_costo" ? estadoRaw : "todos";
  return {
    q: params.get("q")?.trim() ?? "",
    categoria: params.get("categoria")?.trim() ?? "",
    estado,
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

function applyListFilters(query: FilterQuery, filters: AdminCatalogProductFilters): FilterQuery {
  const q = sanitizeSearch(filters.q);
  let next = query;
  if (q) {
    next = next.or(
      `nombre.ilike.%${q}%,marca.ilike.%${q}%,descripcion.ilike.%${q}%,codigo_odoo.ilike.%${q}%,codigo_barras.ilike.%${q}%`
    );
  }
  if (filters.categoria) {
    next = next.eq("categoria", filters.categoria);
  }
  if (filters.estado === "activo") {
    next = next.eq("activo", true);
  } else if (filters.estado === "inactivo") {
    next = next.eq("activo", false);
  }
  return next;
}

function filtrosBase(filters: AdminCatalogProductFilters): AdminCatalogProductFilters {
  return { ...filters, estado: "todos", page: 1 };
}

let costoCache: { at: number; ids: Set<string> } | null = null;
let conteoCache: { key: string; at: number; conteos: AdminCatalogConteos } | null = null;
const COSTO_TTL_MS = 30_000;
const CONTEO_TTL_MS = 15_000;

async function idsConCosto(): Promise<Set<string>> {
  if (costoCache && Date.now() - costoCache.at < COSTO_TTL_MS) {
    return costoCache.ids;
  }
  const supabase = getSupabaseAdminClient();
  const ids = new Set<string>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase
      .from("factura_lineas")
      .select("producto_id, facturas!inner(tipo_documento)")
      .not("producto_id", "is", null)
      .neq("facturas.tipo_documento", "nota_credito")
      .or("costo_unitario.not.is.null,costo_por_presentacion.not.is.null")
      .order("producto_id", { ascending: true })
      .range(from, from + 999);
    if (error) {
      throw error;
    }
    for (const row of data ?? []) {
      const id = text((row as { producto_id?: unknown }).producto_id);
      if (id) {
        ids.add(id);
      }
    }
    if ((data ?? []).length < 1000) {
      break;
    }
  }
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .not("costo_manual", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) {
      throw error;
    }
    for (const row of data ?? []) {
      const id = text((row as { id?: unknown }).id);
      if (id) {
        ids.add(id);
      }
    }
    if ((data ?? []).length < 1000) {
      break;
    }
  }
  costoCache = { at: Date.now(), ids };
  return ids;
}

async function contar(filters: AdminCatalogProductFilters, ids?: string[]): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let query = applyListFilters(asQuery(supabase.from("products").select("id", { count: "exact", head: true })), filters);
  if (ids) {
    query = query.in("id", ids);
  }
  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function contarConCosto(filters: AdminCatalogProductFilters, conCosto: Set<string>): Promise<number> {
  const ids = Array.from(conCosto);
  if (ids.length === 0) {
    return 0;
  }
  const base = filtrosBase(filters);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += COSTO_CHUNK) {
    chunks.push(ids.slice(i, i + COSTO_CHUNK));
  }
  let total = 0;
  for (let i = 0; i < chunks.length; i += 8) {
    const group = chunks.slice(i, i + 8);
    const counts = await Promise.all(group.map((chunk) => contar(base, chunk)));
    total += counts.reduce((sum, value) => sum + value, 0);
  }
  return total;
}

async function conteosDe(filters: AdminCatalogProductFilters, conCosto: Set<string>): Promise<AdminCatalogConteos> {
  const key = `${filters.q}\n${filters.categoria}`;
  if (conteoCache && conteoCache.key === key && Date.now() - conteoCache.at < CONTEO_TTL_MS) {
    return conteoCache.conteos;
  }
  const base = filtrosBase(filters);
  const [todos, activos, inactivos, conCostoEnFiltro] = await Promise.all([
    contar(base),
    contar({ ...base, estado: "activo" }),
    contar({ ...base, estado: "inactivo" }),
    contarConCosto(filters, conCosto),
  ]);
  const conteos = {
    todos,
    activos,
    inactivos,
    sinCosto: Math.max(0, todos - conCostoEnFiltro),
  };
  conteoCache = { key, at: Date.now(), conteos };
  return conteos;
}

async function categoriasDe(): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("categoria").order("categoria", { ascending: true });
  if (error) {
    throw error;
  }
  return Array.from(new Set((data ?? []).map((row) => String(row.categoria ?? "").trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "es")
  );
}

function excluirConCosto(query: FilterQuery, conCosto: Set<string>): FilterQuery {
  if (conCosto.size === 0 || conCosto.size > NOT_IN_MAX) {
    return query;
  }
  return query.not("id", "in", `(${Array.from(conCosto).join(",")})`);
}

async function paginaDirecta(
  filters: AdminCatalogProductFilters,
  conCosto: Set<string>
): Promise<{ rows: AdminCatalogProduct[]; total: number }> {
  const supabase = getSupabaseAdminClient();
  const from = (filters.page - 1) * CATALOG_PRODUCTS_PAGE_SIZE;
  const to = from + CATALOG_PRODUCTS_PAGE_SIZE - 1;
  let query = applyListFilters(
    asQuery(supabase.from("products").select(SELECT_FIELDS, { count: "exact" }).order("nombre", { ascending: true }).range(from, to)),
    filters.estado === "sin_costo" ? { ...filters, estado: "todos" } : filters
  );
  if (filters.estado === "sin_costo") {
    query = excluirConCosto(query, conCosto);
  }
  const { data, error, count } = await query;
  if (error) {
    throw error;
  }
  return {
    rows: (data ?? []).map((row) => mapRow(row as ProductRow)),
    total: count ?? 0,
  };
}

async function idsOrdenados(filters: AdminCatalogProductFilters, max: number, conCosto?: Set<string>): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const ids: string[] = [];
  const base = filters.estado === "sin_costo" ? { ...filters, estado: "todos" as const } : filters;
  for (let from = 0; ids.length < max && from < 20000; from += 1000) {
    let query = applyListFilters(
      asQuery(supabase.from("products").select("id").order("nombre", { ascending: true }).range(from, from + 999)),
      base
    );
    if (filters.estado === "sin_costo" && conCosto && conCosto.size > 0 && conCosto.size <= NOT_IN_MAX) {
      query = excluirConCosto(query, conCosto);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    const batch = (data ?? []).map((row) => String((row as { id: string }).id));
    for (const id of batch) {
      if (filters.estado === "sin_costo" && conCosto && conCosto.size > NOT_IN_MAX && conCosto.has(id)) {
        continue;
      }
      ids.push(id);
      if (ids.length >= max) {
        break;
      }
    }
    if (batch.length < 1000) {
      break;
    }
  }
  return ids;
}

async function filasPorIds(ids: string[]): Promise<AdminCatalogProduct[]> {
  if (ids.length === 0) {
    return [];
  }
  const supabase = getSupabaseAdminClient();
  const products: AdminCatalogProduct[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase.from("products").select(SELECT_FIELDS).in("id", chunk);
    if (error) {
      throw error;
    }
    products.push(...(data ?? []).map((row) => mapRow(row as ProductRow)));
  }
  const order = new Map(ids.map((id, index) => [id, index]));
  return products.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

async function paginaSinCosto(
  filters: AdminCatalogProductFilters,
  conCosto: Set<string>,
  total: number
): Promise<{ rows: AdminCatalogProduct[]; total: number }> {
  if (conCosto.size === 0 || conCosto.size <= NOT_IN_MAX) {
    return paginaDirecta(filters, conCosto);
  }
  const start = (filters.page - 1) * CATALOG_PRODUCTS_PAGE_SIZE;
  const needed = start + CATALOG_PRODUCTS_PAGE_SIZE;
  const ids = await idsOrdenados(filters, needed, conCosto);
  const slice = ids.slice(start, start + CATALOG_PRODUCTS_PAGE_SIZE);
  return { rows: await filasPorIds(slice), total };
}

function fechaClave(emision: unknown, recibido: unknown): string {
  return `${text(emision)?.slice(0, 10) ?? ""} ${text(recibido) ?? ""}`.trim();
}

async function lineasDe(ids: string[]): Promise<LineaCompra[]> {
  if (ids.length === 0) {
    return [];
  }
  const supabase = getSupabaseAdminClient();
  const lineas: LineaCompra[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    for (let from = 0; from < 3000; from += 1000) {
      const { data, error } = await supabase
        .from("factura_lineas")
        .select(
          "producto_id, factura_id, costo_unitario, costo_por_presentacion, facturas!inner(fecha_emision, recibido_en, tipo_documento, proveedor_id, proveedores(id, nombre))"
        )
        .in("producto_id", chunk)
        .neq("facturas.tipo_documento", "nota_credito")
        .order("factura_id", { ascending: false })
        .range(from, from + 999);
      if (error) {
        throw error;
      }
      for (const row of data ?? []) {
        const record = row as Record<string, unknown>;
        const productoId = text(record.producto_id);
        const facturaId = text(record.factura_id);
        if (!productoId || !facturaId) {
          continue;
        }
        const factura = uno(record.facturas) as Record<string, unknown> | null;
        const proveedor = uno(factura?.proveedores) as { id?: unknown; nombre?: unknown } | null;
        const unitario = num(record.costo_unitario);
        const recibido = text(factura?.recibido_en);
        const emision = text(factura?.fecha_emision)?.slice(0, 10) ?? "";
        lineas.push({
          productoId,
          facturaId,
          fecha: fechaClave(factura?.fecha_emision, factura?.recibido_en),
          instante: recibido || emision,
          costo: unitario ?? num(record.costo_por_presentacion),
          proveedorId: text(proveedor?.id) ?? text(factura?.proveedor_id),
          proveedorNombre: text(proveedor?.nombre),
        });
      }
      if ((data ?? []).length < 1000) {
        break;
      }
    }
  }
  return lineas;
}

function resumir(ids: string[], lineas: LineaCompra[]): Map<string, ResumenProducto> {
  const porProducto = new Map<string, LineaCompra[]>();
  for (const linea of lineas) {
    const lista = porProducto.get(linea.productoId) ?? [];
    lista.push(linea);
    porProducto.set(linea.productoId, lista);
  }
  const resumen = new Map<string, ResumenProducto>();
  for (const id of ids) {
    const compras = porProducto.get(id) ?? [];
    const proveedores = new Map<string, AdminCatalogProveedor & { clave: string }>();
    let mejor: LineaCompra | null = null;
    for (const linea of compras) {
      if (linea.proveedorId && linea.proveedorNombre) {
        const actual = proveedores.get(linea.proveedorId);
        if (!actual || linea.fecha > actual.clave) {
          proveedores.set(linea.proveedorId, {
            id: linea.proveedorId,
            nombre: linea.proveedorNombre,
            ultimaCompra: linea.fecha.slice(0, 10) || null,
            clave: linea.fecha,
          });
        }
      }
      if (linea.costo != null && (!mejor || linea.fecha >= mejor.fecha)) {
        mejor = linea;
      }
    }
    const costo = mejor?.costo ?? null;
    resumen.set(id, {
      costo,
      costoEn: mejor?.fecha.slice(0, 10) || null,
      costoClave: mejor?.instante || null,
      proveedores: Array.from(proveedores.values())
        .sort((left, right) => right.clave.localeCompare(left.clave))
        .map(({ id: proveedorId, nombre, ultimaCompra }) => ({ id: proveedorId, nombre, ultimaCompra })),
      compra:
        mejor && costo != null
          ? {
              facturaId: mejor.facturaId,
              fecha: mejor.fecha.slice(0, 10) || null,
              proveedor: mejor.proveedorNombre,
              costo,
            }
          : null,
    });
  }
  return resumen;
}

async function adjuntarResumen(products: AdminCatalogProduct[]): Promise<{
  products: AdminCatalogProduct[];
  compras: Map<string, AdminCatalogCompra | null>;
}> {
  const ids = products.map((product) => product.id);
  const lineas = await lineasDe(ids);
  const resumen = resumir(ids, lineas);
  const compras = new Map<string, AdminCatalogCompra | null>();
  const next = products.map((product) => {
    const item = resumen.get(product.id);
    compras.set(product.id, item?.compra ?? null);
    return aplicarResumen(product, item);
  });
  return { products: next, compras };
}

function paraLista(product: AdminCatalogProduct): AdminCatalogProduct {
  return { ...product, descripcion: recorteDescripcion(product.descripcion) };
}

export async function listAdminCatalogProducts(filters: AdminCatalogProductFilters): Promise<AdminCatalogProductList> {
  const conCosto = await idsConCosto();
  const [categories, conteos] = await Promise.all([categoriasDe(), conteosDe(filters, conCosto)]);
  const page =
    filters.estado === "sin_costo"
      ? await paginaSinCosto(filters, conCosto, conteos.sinCosto)
      : await paginaDirecta(filters, conCosto);
  const { products } = await adjuntarResumen(page.rows);
  return {
    products: products.map(paraLista),
    total: page.total,
    page: filters.page,
    pageSize: CATALOG_PRODUCTS_PAGE_SIZE,
    categories,
    conteos,
  };
}

export async function listAdminCatalogProductIds(filters: AdminCatalogProductFilters): Promise<string[]> {
  if (filters.estado !== "sin_costo") {
    return idsOrdenados(filters, IDS_MAX);
  }
  const conCosto = await idsConCosto();
  return idsOrdenados(filters, IDS_MAX, conCosto);
}

async function presentacionesDe(productoId: string): Promise<AdminCatalogPresentacion[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("producto_presentaciones")
    .select("presentacion, unidades, proveedores(nombre)")
    .eq("producto_id", productoId);
  if (error) {
    throw error;
  }
  const orden = new Map<string, number>(FACTURA_PRESENTACIONES.map((item, index) => [item.id, index]));
  return (data ?? [])
    .map((row) => {
      const record = row as { presentacion?: unknown; unidades?: unknown; proveedores?: { nombre?: unknown } | Array<{ nombre?: unknown }> | null };
      const presentacion = text(record.presentacion);
      const unidades = num(record.unidades);
      if (!presentacion || unidades == null || unidades <= 0) {
        return null;
      }
      const proveedor = uno(record.proveedores);
      return {
        presentacion,
        etiqueta: labelOf(FACTURA_PRESENTACIONES, presentacion),
        unidades,
        proveedor: text(proveedor?.nombre),
      };
    })
    .filter((item): item is AdminCatalogPresentacion => item != null)
    .sort(
      (left, right) =>
        (orden.get(left.presentacion) ?? 9) - (orden.get(right.presentacion) ?? 9) ||
        (left.proveedor ?? "").localeCompare(right.proveedor ?? "", "es")
    );
}

export async function getAdminCatalogProduct(id: string): Promise<AdminCatalogProductDetalle | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select(SELECT_FIELDS).eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const [resumen, presentaciones, categories] = await Promise.all([
    adjuntarResumen([mapRow(data as ProductRow)]),
    presentacionesDe(id),
    categoriasDe(),
  ]);
  const product = resumen.products[0];
  if (!product) {
    return null;
  }
  return {
    product,
    compra: resumen.compras.get(id) ?? null,
    presentaciones,
    categories,
  };
}

export async function fetchAdminCatalogProductsForExport(
  filters: AdminCatalogProductFilters,
  ids?: string[]
): Promise<AdminCatalogProduct[]> {
  let products: AdminCatalogProduct[] = [];
  if (ids && ids.length > 0) {
    const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, EXPORT_MAX);
    products = await filasPorIds(unique);
    products.sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
  } else if (filters.estado === "sin_costo") {
    const conCosto = await idsConCosto();
    const matching = await idsOrdenados(filters, EXPORT_MAX, conCosto);
    products = await filasPorIds(matching);
  } else {
    const supabase = getSupabaseAdminClient();
    for (let from = 0; from < EXPORT_MAX; from += 1000) {
      const { data, error } = await applyListFilters(
        asQuery(supabase.from("products").select(SELECT_FIELDS).order("nombre", { ascending: true }).range(from, from + 999)),
        filters
      );
      if (error) {
        throw error;
      }
      const batch = (data ?? []).map((row) => mapRow(row as ProductRow));
      products.push(...batch);
      if (batch.length < 1000) {
        break;
      }
    }
  }
  const { products: conResumen } = await adjuntarResumen(products);
  return conResumen;
}

export function catalogExportRows(products: AdminCatalogProduct[]): Array<Array<string | number>> {
  return products.map((product) => [
    product.fotoUrl || "",
    product.nombre,
    product.marca || "",
    isUncategorized(product.categoria) ? "Sin categoría" : product.categoria,
    product.precio,
    product.costo ?? "",
    etiquetaCostoFuente(product.costoFuente),
    product.margen == null ? "" : Math.round(product.margen * 1000) / 10,
    product.proveedores.map((item) => item.nombre).join(", "),
    product.codigoOdoo || "",
    product.codigoBarras || "",
    product.activo ? "Activo" : "Inactivo",
  ]);
}

export async function updateAdminCatalogProduct(input: {
  id: string;
  nombre?: unknown;
  descripcion?: unknown;
  marca?: unknown;
  categoria?: unknown;
  precio?: unknown;
  costo?: unknown;
  activo?: unknown;
}): Promise<AdminCatalogProduct> {
  if (!input.id) {
    throw new Error("Falta el producto");
  }
  const patch: {
    nombre?: string;
    descripcion?: string | null;
    marca?: string | null;
    categoria?: string;
    precio?: number;
    costo_manual?: number | null;
    costo_manual_fuente?: CostoManualFuente | null;
    costo_manual_en?: string | null;
    activo?: boolean;
  } = {};
  if (input.nombre !== undefined) {
    const nombre = String(input.nombre ?? "").trim();
    if (!nombre) {
      throw new Error("El nombre no puede quedar vacío");
    }
    patch.nombre = nombre;
  }
  if (input.descripcion !== undefined) {
    const descripcion = String(input.descripcion ?? "").trim();
    patch.descripcion = descripcion ? descripcion.slice(0, 4000) : null;
  }
  if (input.marca !== undefined) {
    const marca = input.marca == null ? "" : String(input.marca).trim();
    patch.marca = marca || null;
  }
  if (input.categoria !== undefined) {
    const categoria = String(input.categoria ?? "").trim();
    if (!categoria) {
      throw new Error("La categoría no puede quedar vacía");
    }
    patch.categoria = categoria;
  }
  if (input.precio !== undefined) {
    const parsed = typeof input.precio === "number" ? input.precio : parsePrice(String(input.precio ?? ""));
    if (parsed == null || parsed < 0) {
      throw new Error("Precio inválido");
    }
    patch.precio = Math.round(parsed * 100) / 100;
  }
  if (input.costo !== undefined) {
    if (input.costo == null || input.costo === "") {
      patch.costo_manual = null;
      patch.costo_manual_fuente = null;
      patch.costo_manual_en = null;
    } else {
      const parsed = typeof input.costo === "number" ? input.costo : parsePrice(String(input.costo));
      if (parsed == null || parsed < 0) {
        throw new Error("Costo inválido");
      }
      patch.costo_manual = Math.round(parsed * 10000) / 10000;
      patch.costo_manual_fuente = "admin";
      patch.costo_manual_en = new Date().toISOString();
    }
  }
  if (input.activo !== undefined) {
    if (typeof input.activo !== "boolean") {
      throw new Error("Estado inválido");
    }
    patch.activo = input.activo;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error("Nada que actualizar");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").update(patch).eq("id", input.id).select(SELECT_FIELDS).maybeSingle();
  if (error || !data) {
    throw error ?? new Error("No pudimos guardar el producto");
  }
  costoCache = null;
  conteoCache = null;
  const mapped = mapRow(data as ProductRow);
  let product = mapped;
  try {
    const resumen = await adjuntarResumen([mapped]);
    product = resumen.products[0] ?? mapped;
  } catch (resumenError) {
    console.error("[admin] catalog product cost", resumenError);
  }
  await publishAgentEvent("producto.actualizado", {
    id: product.id,
    nombre: product.nombre,
    marca: product.marca,
    categoria: product.categoria,
    precio: product.precio,
    codigoOdoo: product.codigoOdoo,
    codigoBarras: product.codigoBarras,
    activo: product.activo,
  });
  return product;
}

export async function batchUpdateAdminCatalogProducts(input: {
  ids: string[];
  activo?: unknown;
  categoria?: unknown;
}): Promise<{ updated: number }> {
  const ids = Array.from(new Set(input.ids.map((id) => id.trim()).filter(Boolean))).slice(0, BATCH_MAX);
  if (ids.length === 0) {
    throw new Error("No hay productos seleccionados");
  }
  const patch: { activo?: boolean; categoria?: string } = {};
  if (input.activo !== undefined) {
    if (typeof input.activo !== "boolean") {
      throw new Error("Estado inválido");
    }
    patch.activo = input.activo;
  }
  if (input.categoria !== undefined) {
    const categoria = String(input.categoria ?? "").trim();
    if (!categoria) {
      throw new Error("La categoría no puede quedar vacía");
    }
    patch.categoria = categoria;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error("Nada que actualizar");
  }

  const supabase = getSupabaseAdminClient();
  let updated = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error, count } = await supabase.from("products").update(patch, { count: "exact" }).in("id", chunk);
    if (error) {
      throw error;
    }
    updated += count ?? chunk.length;
  }
  await publishAgentEvent("productos.actualizados", { updated, ...patch });
  return { updated };
}
