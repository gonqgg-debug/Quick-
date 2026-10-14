import {
  PROPUESTA_ACEPTAR_TODAS,
  PROPUESTA_CONFIANZA,
  confianzaTexto,
  isUuid,
  normalizarDescripcion,
  resolverUnidades,
  type FacturaPresentacion,
  type FacturaPropuestaOrigen,
} from "@/lib/facturas-shared";
import type { Actor } from "@/lib/operacion-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";

/** Por debajo de esto no vale la pena guardar una propuesta por nombre. */
const SIMILITUD_MINIMA = 0.25;

type LineaCatalogo = {
  id: string;
  descripcion: string | null;
  codigoSku: string | null;
  codigoBarras: string | null;
  productoId: string | null;
  presentacion: FacturaPresentacion | null;
  cantidadComprada: number | null;
  unidadesPorPresentacion: number | null;
  costoPorPresentacion: number | null;
};

export type Vinculo = { descripcion: string | null; productoId: string };

function num(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapLinea(row: Record<string, unknown>): LineaCatalogo {
  return {
    id: String(row.id),
    descripcion: text(row.descripcion_original) ?? text(row.producto_normalizado),
    codigoSku: text(row.codigo_sku),
    codigoBarras: text(row.codigo_barras),
    productoId: typeof row.producto_id === "string" && isUuid(row.producto_id) ? row.producto_id : null,
    presentacion: (text(row.presentacion) as FacturaPresentacion | null) ?? null,
    cantidadComprada: num(row.cantidad_comprada),
    unidadesPorPresentacion: num(row.unidades_por_presentacion),
    costoPorPresentacion: num(row.costo_por_presentacion),
  };
}

async function lineasDe(facturaId: string): Promise<LineaCatalogo[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_lineas")
    .select("id, descripcion_original, producto_normalizado, codigo_sku, codigo_barras, producto_id, presentacion, cantidad_comprada, unidades_por_presentacion, costo_por_presentacion")
    .eq("factura_id", facturaId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapLinea(row as Record<string, unknown>));
}

async function proveedorDe(facturaId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("facturas").select("proveedor_id").eq("id", facturaId).maybeSingle();
  if (error) {
    throw error;
  }
  return typeof data?.proveedor_id === "string" && isUuid(data.proveedor_id) ? data.proveedor_id : null;
}

async function unicoPor(columna: "codigo_barras" | "codigo_odoo", valor: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("id").eq(columna, valor).limit(2);
  if (error) {
    throw error;
  }
  return data?.length === 1 ? String(data[0].id) : null;
}

async function aliasDe(proveedorId: string, descripcionNorm: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalogo_alias")
    .select("producto_id")
    .eq("proveedor_id", proveedorId)
    .eq("descripcion_norm", descripcionNorm)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return typeof data?.producto_id === "string" ? data.producto_id : null;
}

type Propuesta = { productoId: string; confianza: number; origen: FacturaPropuestaOrigen };

async function proponer(linea: LineaCatalogo, proveedorId: string | null): Promise<Propuesta | null> {
  const norm = normalizarDescripcion(linea.descripcion);
  if (proveedorId && norm) {
    const productoId = await aliasDe(proveedorId, norm);
    if (productoId) {
      return { productoId, confianza: PROPUESTA_CONFIANZA.alias, origen: "alias" };
    }
  }
  if (linea.codigoBarras) {
    const productoId = await unicoPor("codigo_barras", linea.codigoBarras);
    if (productoId) {
      return { productoId, confianza: PROPUESTA_CONFIANZA.barras, origen: "barras" };
    }
  }
  if (linea.codigoSku) {
    const productoId = await unicoPor("codigo_odoo", linea.codigoSku);
    if (productoId) {
      return { productoId, confianza: PROPUESTA_CONFIANZA.odoo, origen: "odoo" };
    }
  }
  if (!linea.descripcion) {
    return null;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("productos_similares", { q: linea.descripcion, limite: 1 });
  if (error) {
    throw error;
  }
  const mejor = Array.isArray(data) ? (data[0] as { id?: unknown; similitud?: unknown } | undefined) : undefined;
  const similitud = num(mejor?.similitud);
  if (!mejor || typeof mejor.id !== "string" || similitud == null || similitud < SIMILITUD_MINIMA) {
    return null;
  }
  return { productoId: mejor.id, confianza: confianzaTexto(similitud), origen: "texto" };
}

/**
 * Propone un producto para cada línea sin catálogo. Un alias ya confirmado para ese proveedor se liga directo;
 * lo demás queda como propuesta hasta que Phillip o una persona la acepte.
 */
export async function proponerCatalogo(facturaId: string): Promise<void> {
  const proveedorId = await proveedorDe(facturaId);
  const supabase = getSupabaseAdminClient();
  for (const linea of await lineasDe(facturaId)) {
    if (linea.productoId) {
      continue;
    }
    const propuesta = await proponer(linea, proveedorId);
    const update =
      propuesta?.origen === "alias"
        ? { producto_id: propuesta.productoId, propuesta_producto_id: null, propuesta_confianza: null, propuesta_origen: null }
        : {
            propuesta_producto_id: propuesta?.productoId ?? null,
            propuesta_confianza: propuesta?.confianza ?? null,
            propuesta_origen: propuesta?.origen ?? null,
          };
    const { error } = await supabase.from("factura_lineas").update(update).eq("id", linea.id);
    if (error) {
      throw error;
    }
  }
}

/** Guarda o refuerza el vínculo descripción → producto para ese proveedor. */
export async function aprenderAlias(proveedorId: string | null, descripcion: string | null, productoId: string, actor: Actor): Promise<void> {
  const norm = normalizarDescripcion(descripcion);
  if (!proveedorId || !norm) {
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalogo_alias")
    .select("id, producto_id, veces")
    .eq("proveedor_id", proveedorId)
    .eq("descripcion_norm", norm)
    .maybeSingle();
  if (error) {
    throw error;
  }
  const ahora = new Date().toISOString();
  if (data?.id) {
    const mismo = data.producto_id === productoId;
    const { error: updateError } = await supabase
      .from("catalogo_alias")
      .update({ producto_id: productoId, confirmado_por: actor, veces: mismo ? (num(data.veces) ?? 0) + 1 : 1, updated_at: ahora })
      .eq("id", data.id);
    if (updateError) {
      throw updateError;
    }
    return;
  }
  const { error: insertError } = await supabase
    .from("catalogo_alias")
    .insert({ proveedor_id: proveedorId, descripcion_norm: norm, producto_id: productoId, confirmado_por: actor });
  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }
}

export async function aprenderVinculos(facturaId: string, vinculos: Vinculo[], actor: Actor): Promise<void> {
  if (!vinculos.length) {
    return;
  }
  const proveedorId = await proveedorDe(facturaId);
  for (const vinculo of vinculos) {
    await aprenderAlias(proveedorId, vinculo.descripcion, vinculo.productoId, actor);
  }
}

async function unidadesGuardadas(productoId: string, proveedorId: string | null, presentacion: FacturaPresentacion): Promise<number | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("producto_presentaciones")
    .select("proveedor_id, unidades")
    .eq("producto_id", productoId)
    .eq("presentacion", presentacion);
  if (error) {
    throw error;
  }
  const filas = data ?? [];
  const delProveedor = proveedorId ? filas.find((row) => row.proveedor_id === proveedorId) : undefined;
  const general = filas.find((row) => row.proveedor_id == null);
  return num((delProveedor ?? general)?.unidades);
}

/** Completa unidades y costo unitario de las líneas ligadas a un producto con presentación conocida. */
export async function completarUnidades(facturaId: string): Promise<void> {
  const proveedorId = await proveedorDe(facturaId);
  const supabase = getSupabaseAdminClient();
  for (const linea of await lineasDe(facturaId)) {
    if (!linea.productoId || !linea.presentacion || linea.presentacion === "unidad" || linea.unidadesPorPresentacion != null) {
      continue;
    }
    const unidades = await unidadesGuardadas(linea.productoId, proveedorId, linea.presentacion);
    if (unidades == null) {
      continue;
    }
    const resuelto = resolverUnidades({
      presentacion: linea.presentacion,
      cantidadComprada: linea.cantidadComprada,
      unidadesPorPresentacion: unidades,
      unidadesTotales: null,
      costoPorPresentacion: linea.costoPorPresentacion,
      costoUnitario: null,
    });
    const { error } = await supabase
      .from("factura_lineas")
      .update({
        unidades_por_presentacion: resuelto.unidadesPorPresentacion,
        unidades_totales: resuelto.unidadesTotales,
        costo_unitario: resuelto.costoUnitario,
      })
      .eq("id", linea.id);
    if (error) {
      throw error;
    }
  }
}

const PRESENTACIONES_GUARDABLES: FacturaPresentacion[] = ["paquete", "caja", "fardo", "otro"];

export type PresentacionGuardada = {
  productoId: string;
  proveedorId: string | null;
  presentacion: FacturaPresentacion;
  unidades: number;
  lineasCompletadas: number;
};

/** Guarda cuántas unidades trae una presentación y completa las líneas abiertas de ese producto. */
export async function guardarPresentacion(body: Record<string, unknown>, actor: Actor): Promise<PresentacionGuardada> {
  if (actor !== "phillip" && actor !== "admin") {
    throw new Error("Solo Phillip guarda las presentaciones del catálogo");
  }
  const productoId = typeof body.productoId === "string" ? body.productoId.trim() : "";
  if (!isUuid(productoId)) {
    throw new Error("Manda productoId del catálogo");
  }
  const proveedorRaw = typeof body.proveedorId === "string" ? body.proveedorId.trim() : "";
  const proveedorId = proveedorRaw ? proveedorRaw : null;
  if (proveedorId && !isUuid(proveedorId)) {
    throw new Error("El proveedor no es válido");
  }
  const presentacion = typeof body.presentacion === "string" ? (body.presentacion.trim().toLowerCase() as FacturaPresentacion) : null;
  if (!presentacion || !PRESENTACIONES_GUARDABLES.includes(presentacion)) {
    throw new Error("La presentación tiene que ser paquete, caja, fardo u otro");
  }
  const unidades = num(body.unidades ?? body.unidadesPorPresentacion);
  if (unidades == null || !(unidades > 0) || unidades > 100000) {
    throw new Error("Las unidades por presentación tienen que ser mayores que cero");
  }
  const supabase = getSupabaseAdminClient();
  const { data: producto, error: productoError } = await supabase.from("products").select("id").eq("id", productoId).maybeSingle();
  if (productoError) {
    throw productoError;
  }
  if (!producto) {
    throw new Error("No encontramos ese producto en el catálogo");
  }
  let existente = supabase.from("producto_presentaciones").select("id").eq("producto_id", productoId).eq("presentacion", presentacion);
  existente = proveedorId ? existente.eq("proveedor_id", proveedorId) : existente.is("proveedor_id", null);
  const { data: fila, error: filaError } = await existente.maybeSingle();
  if (filaError) {
    throw filaError;
  }
  const row = { producto_id: productoId, proveedor_id: proveedorId, presentacion, unidades, confirmado_por: actor, updated_at: new Date().toISOString() };
  const { error } = fila?.id
    ? await supabase.from("producto_presentaciones").update(row).eq("id", fila.id)
    : await supabase.from("producto_presentaciones").insert(row);
  if (error) {
    throw error;
  }

  const { data: lineas, error: lineasError } = await supabase
    .from("factura_lineas")
    .select("factura_id, facturas!inner ( proveedor_id, estado )")
    .eq("producto_id", productoId)
    .eq("presentacion", presentacion)
    .is("unidades_por_presentacion", null)
    .neq("facturas.estado", "conciliada");
  if (lineasError) {
    throw lineasError;
  }
  const facturas = new Set<string>();
  let lineasCompletadas = 0;
  for (const linea of lineas ?? []) {
    const embed = (Array.isArray(linea.facturas) ? linea.facturas[0] : linea.facturas) as { proveedor_id?: unknown } | null;
    if (proveedorId && embed?.proveedor_id !== proveedorId) {
      continue;
    }
    lineasCompletadas += 1;
    facturas.add(String(linea.factura_id));
  }
  for (const facturaId of Array.from(facturas)) {
    await completarUnidades(facturaId);
  }
  return { productoId, proveedorId, presentacion, unidades, lineasCompletadas };
}

export async function lineasParaAceptar(facturaId: string, minimo: number): Promise<Array<{ id: string; productoId: string; descripcion: string | null }>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_lineas")
    .select("id, propuesta_producto_id, descripcion_original, producto_normalizado")
    .eq("factura_id", facturaId)
    .is("producto_id", null)
    .gte("propuesta_confianza", Math.max(PROPUESTA_ACEPTAR_TODAS, minimo));
  if (error) {
    throw error;
  }
  return (data ?? [])
    .filter((row) => typeof row.propuesta_producto_id === "string")
    .map((row) => ({
      id: String(row.id),
      productoId: String(row.propuesta_producto_id),
      descripcion: text(row.descripcion_original) ?? text(row.producto_normalizado),
    }));
}
