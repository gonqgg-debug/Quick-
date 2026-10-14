import {
  CANDIDATOS_POR_LINEA,
  FACTURA_PRESENTACIONES,
  PROPUESTA_CONFIANZA,
  clavesAlias,
  isUuid,
  normalizarDescripcion,
  resolverUnidades,
  type FacturaCandidato,
  type FacturaCandidatoSenal,
  type FacturaPresentacion,
  type FacturaProductoCatalogo,
  type FacturaPropuestaOrigen,
} from "@/lib/facturas-shared";
import type { Actor } from "@/lib/operacion-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";

/** Por debajo de esto un nombre parecido no se ofrece como candidato. */
const SIMILITUD_MINIMA = 0.25;

export const SIN_PROPUESTA = {
  propuesta_producto_id: null,
  propuesta_confianza: null,
  propuesta_origen: null,
  propuesta_razon: null,
  propuesta_por: null,
  propuesta_en: null,
};

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
  numeroLinea: number;
  propuestaOrigen: string | null;
  estado: string | null;
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
    numeroLinea: num(row.numero_linea) ?? 0,
    propuestaOrigen: text(row.propuesta_origen),
    estado: text(row.estado),
  };
}

async function lineasDe(facturaId: string): Promise<LineaCatalogo[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_lineas")
    .select(
      "id, numero_linea, estado, descripcion_original, producto_normalizado, codigo_sku, codigo_barras, producto_id, presentacion, cantidad_comprada, unidades_por_presentacion, costo_por_presentacion, propuesta_origen"
    )
    .eq("factura_id", facturaId)
    .order("numero_linea", { ascending: true });
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

async function aliasAprendido(proveedorId: string, descripcion: string | null, codigoSku: string | null): Promise<string | null> {
  for (const clave of clavesAlias(descripcion, codigoSku)) {
    const productoId = await aliasDe(proveedorId, clave);
    if (productoId) {
      return productoId;
    }
  }
  return null;
}

async function proponer(linea: LineaCatalogo, proveedorId: string | null): Promise<Propuesta | null> {
  if (proveedorId) {
    const productoId = await aliasAprendido(proveedorId, linea.descripcion, linea.codigoSku);
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
  return null;
}

/**
 * Señales exactas para cada línea sin catálogo. Un alias ya confirmado para ese proveedor se liga directo;
 * código de barras u Odoo quedan como propuesta. Lo que Phillip ya propuso no se pisa, salvo por un alias.
 */
export async function proponerCatalogo(facturaId: string): Promise<void> {
  const proveedorId = await proveedorDe(facturaId);
  const supabase = getSupabaseAdminClient();
  for (const linea of await lineasDe(facturaId)) {
    if (linea.productoId) {
      continue;
    }
    const propuesta = await proponer(linea, proveedorId);
    if (linea.propuestaOrigen === "agente" && propuesta?.origen !== "alias") {
      continue;
    }
    const update =
      propuesta?.origen === "alias"
        ? {
            producto_id: propuesta.productoId,
            ...SIN_PROPUESTA,
            origen_ligue: "alias",
            producto_confirmado_por: null,
            producto_confirmado_en: null,
            ...(linea.estado === "ambigua" ? { estado: "completa" } : {}),
          }
        : {
            propuesta_producto_id: propuesta?.productoId ?? null,
            propuesta_confianza: propuesta?.confianza ?? null,
            propuesta_origen: propuesta?.origen ?? null,
            propuesta_razon: null,
            propuesta_por: null,
            propuesta_en: null,
            origen_ligue: null,
            producto_confirmado_por: null,
            producto_confirmado_en: null,
          };
    const { error } = await supabase.from("factura_lineas").update(update).eq("id", linea.id);
    if (error) {
      throw error;
    }
  }
}

/** Guarda o refuerza el vínculo descripción (y código SKU, si viene) → producto para ese proveedor. */
export async function aprenderAlias(
  proveedorId: string | null,
  descripcion: string | null,
  productoId: string,
  confirmadoPor: string,
  codigoSku: string | null = null
): Promise<void> {
  for (const norm of clavesAlias(descripcion, codigoSku)) {
    await guardarAlias(proveedorId, norm, productoId, confirmadoPor);
  }
}

async function guardarAlias(proveedorId: string | null, norm: string, productoId: string, confirmadoPor: string): Promise<void> {
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
      .update({ producto_id: productoId, confirmado_por: confirmadoPor, veces: mismo ? (num(data.veces) ?? 0) + 1 : 1, updated_at: ahora })
      .eq("id", data.id);
    if (updateError) {
      throw updateError;
    }
    return;
  }
  const { error: insertError } = await supabase
    .from("catalogo_alias")
    .insert({ proveedor_id: proveedorId, descripcion_norm: norm, producto_id: productoId, confirmado_por: confirmadoPor });
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
  const quien = typeof body.confirmadoPor === "string" && body.confirmadoPor.trim() ? body.confirmadoPor.trim() : actor;
  const row = { producto_id: productoId, proveedor_id: proveedorId, presentacion, unidades, confirmado_por: quien, updated_at: new Date().toISOString() };
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

export async function lineasParaAceptar(
  facturaId: string,
  minimo: number,
  maximo = 100
): Promise<Array<{ id: string; productoId: string; descripcion: string | null; codigoSku: string | null; numeroLinea: number; estado: string | null }>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_lineas")
    .select("id, numero_linea, estado, propuesta_producto_id, descripcion_original, producto_normalizado, codigo_sku")
    .eq("factura_id", facturaId)
    .is("producto_id", null)
    .gte("propuesta_confianza", minimo)
    .lte("propuesta_confianza", maximo);
  if (error) {
    throw error;
  }
  return (data ?? [])
    .filter((row) => typeof row.propuesta_producto_id === "string")
    .map((row) => ({
      id: String(row.id),
      productoId: String(row.propuesta_producto_id),
      descripcion: text(row.descripcion_original) ?? text(row.producto_normalizado),
      codigoSku: text(row.codigo_sku),
      numeroLinea: num(row.numero_linea) ?? 0,
      estado: text(row.estado),
    }));
}

export type LineaParaCandidatos = { id: string; descripcion: string | null; codigoSku: string | null; codigoBarras: string | null };

async function productosPor(columna: "codigo_barras" | "codigo_odoo", valor: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("id").eq(columna, valor).limit(CANDIDATOS_POR_LINEA);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => String(row.id));
}

async function similares(descripcion: string): Promise<Array<{ id: string; similitud: number }>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("productos_similares", { q: descripcion, limite: CANDIDATOS_POR_LINEA });
  if (error) {
    throw error;
  }
  return (Array.isArray(data) ? (data as Array<{ id?: unknown; similitud?: unknown }>) : [])
    .map((row) => ({ id: typeof row.id === "string" ? row.id : "", similitud: num(row.similitud) ?? 0 }))
    .filter((row) => row.id && row.similitud >= SIMILITUD_MINIMA);
}

async function productosCatalogo(ids: string[]): Promise<Map<string, FacturaProductoCatalogo>> {
  const porId = new Map<string, FacturaProductoCatalogo>();
  if (!ids.length) {
    return porId;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("id, nombre, marca, codigo_odoo, codigo_barras").in("id", ids);
  if (error) {
    throw error;
  }
  for (const row of data ?? []) {
    const nombre = text(row.nombre);
    if (!nombre) {
      continue;
    }
    porId.set(String(row.id), {
      id: String(row.id),
      nombre,
      marca: text(row.marca),
      codigoOdoo: text(row.codigo_odoo),
      codigoBarras: text(row.codigo_barras),
    });
  }
  return porId;
}

async function presentacionesDe(ids: string[], proveedorId: string | null): Promise<Map<string, FacturaCandidato["presentaciones"]>> {
  const porProducto = new Map<string, FacturaCandidato["presentaciones"]>();
  if (!ids.length) {
    return porProducto;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("producto_presentaciones").select("producto_id, proveedor_id, presentacion, unidades").in("producto_id", ids);
  if (error) {
    throw error;
  }
  for (const row of data ?? []) {
    const presentacion = FACTURA_PRESENTACIONES.find((item) => item.id === row.presentacion)?.id;
    const unidades = num(row.unidades);
    const delProveedor = row.proveedor_id != null && row.proveedor_id === proveedorId;
    if (!presentacion || unidades == null || (row.proveedor_id != null && !delProveedor)) {
      continue;
    }
    const lista = porProducto.get(String(row.producto_id)) ?? [];
    lista.push({ presentacion, unidades, delProveedor });
    porProducto.set(String(row.producto_id), lista);
  }
  return porProducto;
}

async function ultimasCompras(ids: string[], proveedorId: string | null, facturaId: string): Promise<Map<string, NonNullable<FacturaCandidato["ultimaCompra"]>>> {
  const porProducto = new Map<string, NonNullable<FacturaCandidato["ultimaCompra"]>>();
  if (!ids.length || !proveedorId) {
    return porProducto;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_lineas")
    .select("producto_id, descripcion_original, producto_normalizado, presentacion, cantidad_comprada, costo_por_presentacion, costo_unitario, facturas!inner ( proveedor_id, fecha_emision, recibido_en )")
    .in("producto_id", ids)
    .eq("facturas.proveedor_id", proveedorId)
    .neq("factura_id", facturaId)
    .limit(500);
  if (error) {
    throw error;
  }
  for (const row of data ?? []) {
    const factura = (Array.isArray(row.facturas) ? row.facturas[0] : row.facturas) as { fecha_emision?: unknown; recibido_en?: unknown } | null;
    const fecha = text(factura?.fecha_emision)?.slice(0, 10) ?? text(factura?.recibido_en)?.slice(0, 10) ?? null;
    const productoId = String(row.producto_id);
    const actual = porProducto.get(productoId);
    if (actual && (actual.fecha ?? "") >= (fecha ?? "")) {
      continue;
    }
    porProducto.set(productoId, {
      fecha,
      descripcion: text(row.descripcion_original) ?? text(row.producto_normalizado),
      presentacion: FACTURA_PRESENTACIONES.find((item) => item.id === row.presentacion)?.id ?? null,
      cantidad: num(row.cantidad_comprada),
      costoPorPresentacion: num(row.costo_por_presentacion),
      costoUnitario: num(row.costo_unitario),
    });
  }
  return porProducto;
}

/**
 * Candidatos del catálogo para cada línea: coincidencias exactas (alias, código de barras, Odoo) y nombres parecidos,
 * con presentaciones guardadas y la última compra a ese proveedor. No elige: eso lo hace Phillip.
 */
export async function candidatosCatalogo(facturaId: string, lineas: LineaParaCandidatos[]): Promise<Map<string, FacturaCandidato[]>> {
  const proveedorId = await proveedorDe(facturaId);
  const porLinea = new Map<string, Map<string, { senales: Set<FacturaCandidatoSenal>; similitud: number | null }>>();
  for (const linea of lineas) {
    const encontrados = new Map<string, { senales: Set<FacturaCandidatoSenal>; similitud: number | null }>();
    const agregar = (productoId: string, senal: FacturaCandidatoSenal, similitud: number | null = null) => {
      const actual = encontrados.get(productoId) ?? { senales: new Set<FacturaCandidatoSenal>(), similitud: null };
      actual.senales.add(senal);
      if (similitud != null) {
        actual.similitud = Math.max(actual.similitud ?? 0, similitud);
      }
      encontrados.set(productoId, actual);
    };
    const norm = normalizarDescripcion(linea.descripcion);
    if (proveedorId && norm) {
      const alias = await aliasDe(proveedorId, norm);
      if (alias) {
        agregar(alias, "alias");
      }
    }
    if (linea.codigoBarras) {
      for (const id of await productosPor("codigo_barras", linea.codigoBarras)) {
        agregar(id, "barras");
      }
    }
    if (linea.codigoSku) {
      for (const id of await productosPor("codigo_odoo", linea.codigoSku)) {
        agregar(id, "odoo");
      }
    }
    if (linea.descripcion) {
      for (const parecido of await similares(linea.descripcion)) {
        agregar(parecido.id, "texto", parecido.similitud);
      }
    }
    porLinea.set(linea.id, encontrados);
  }

  const ids = Array.from(new Set(Array.from(porLinea.values()).flatMap((encontrados) => Array.from(encontrados.keys()))));
  const [productos, presentaciones, compras] = await Promise.all([
    productosCatalogo(ids),
    presentacionesDe(ids, proveedorId),
    ultimasCompras(ids, proveedorId, facturaId),
  ]);
  const peso = (senales: Set<FacturaCandidatoSenal>) =>
    senales.has("alias") ? 3 : senales.has("barras") ? 2 : senales.has("odoo") ? 1 : 0;

  const resultado = new Map<string, FacturaCandidato[]>();
  porLinea.forEach((encontrados, lineaId) => {
    const candidatos: FacturaCandidato[] = [];
    encontrados.forEach((info, productoId) => {
      const producto = productos.get(productoId);
      if (!producto) {
        return;
      }
      candidatos.push({
        producto,
        senales: Array.from(info.senales),
        similitud: info.similitud == null ? null : Math.round(info.similitud * 100) / 100,
        presentaciones: presentaciones.get(productoId) ?? [],
        ultimaCompra: compras.get(productoId) ?? null,
      });
    });
    candidatos.sort(
      (a, b) =>
        peso(new Set(b.senales)) - peso(new Set(a.senales)) ||
        Number(Boolean(b.ultimaCompra)) - Number(Boolean(a.ultimaCompra)) ||
        (b.similitud ?? 0) - (a.similitud ?? 0)
    );
    resultado.set(lineaId, candidatos);
  });
  return resultado;
}
