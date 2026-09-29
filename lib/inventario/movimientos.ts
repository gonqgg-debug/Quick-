import { publishAgentEvent } from "@/lib/agent-events";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { toMoney } from "@/lib/money";
import {
  costoPromedioSiguiente,
  normalizarTienda,
  roundCantidad,
  roundCosto,
} from "@/lib/inventario/costos";
import type {
  Existencia,
  InventarioMovimientoTipo,
  InventarioOrigen,
  Movimiento,
} from "@/lib/inventario/shared";
import { INVENTARIO_PAGE_SIZE } from "@/lib/inventario/shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInventarioUuid(value: string): boolean {
  return UUID.test(value);
}

type StockRow = {
  cantidad: number;
  costoPromedio: number | null;
  ultimoCosto: number | null;
  puntoReorden: number;
};

const EMPTY_STOCK: StockRow = {
  cantidad: 0,
  costoPromedio: null,
  ultimoCosto: null,
  puntoReorden: 0,
};

function num(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

export function schemaInventarioFalta(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /inventario_existencias|inventario_movimientos|schema cache|does not exist/i.test(message);
}

async function leerStock(productoId: string, tienda: string): Promise<StockRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("inventario_existencias")
    .select("cantidad, costo_promedio, ultimo_costo, punto_reorden")
    .eq("producto_id", productoId)
    .eq("tienda", tienda)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return { ...EMPTY_STOCK };
  }
  return {
    cantidad: roundCantidad(num(data.cantidad) ?? 0),
    costoPromedio: num(data.costo_promedio) == null ? null : roundCosto(num(data.costo_promedio) as number),
    ultimoCosto: num(data.ultimo_costo) == null ? null : roundCosto(num(data.ultimo_costo) as number),
    puntoReorden: roundCantidad(Math.max(0, num(data.punto_reorden) ?? 0)),
  };
}

async function guardarStock(productoId: string, tienda: string, stock: StockRow): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("inventario_existencias").upsert(
    {
      producto_id: productoId,
      tienda,
      cantidad: stock.cantidad,
      costo_promedio: stock.costoPromedio,
      ultimo_costo: stock.ultimoCosto,
      punto_reorden: stock.puntoReorden,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "producto_id,tienda" }
  );
  if (error) {
    throw error;
  }
}

export type MovimientoInput = {
  productoId: string;
  tienda: string;
  tipo: InventarioMovimientoTipo;
  cantidad: number;
  costoUnitario?: number | null;
  facturaId?: string | null;
  facturaLineaId?: string | null;
  compraId?: string | null;
  origen: InventarioOrigen;
  nota?: string | null;
  contado?: number | null;
};

export type MovimientoEscrito = {
  yaExistia: boolean;
  stockAntes: number;
  stockDespues: number;
  costoPromedioDespues: number | null;
  ultimoCosto: number | null;
};

export async function escribirMovimiento(input: MovimientoInput): Promise<MovimientoEscrito> {
  const tienda = normalizarTienda(input.tienda);
  const antes = await leerStock(input.productoId, tienda);
  let cantidad = roundCantidad(input.cantidad);
  let stockDespues = antes.cantidad;
  let costoPromedio = antes.costoPromedio;
  let ultimoCosto = antes.ultimoCosto;
  const costoUnitario = input.costoUnitario == null ? null : roundCosto(input.costoUnitario);

  if (input.tipo === "conteo") {
    const contado = roundCantidad(input.contado ?? 0);
    if (contado < 0) {
      throw new Error("La cantidad contada no puede ser negativa");
    }
    cantidad = roundCantidad(contado - antes.cantidad);
    stockDespues = contado;
  } else if (input.tipo === "recepcion") {
    if (!(cantidad > 0)) {
      throw new Error("La recepción tiene que traer unidades");
    }
    if (costoUnitario == null) {
      throw new Error("La recepción necesita un costo");
    }
    stockDespues = roundCantidad(antes.cantidad + cantidad);
    costoPromedio = costoPromedioSiguiente(antes.cantidad, antes.costoPromedio, cantidad, costoUnitario);
    ultimoCosto = costoUnitario;
  } else if (input.tipo === "merma" || input.tipo === "venta" || input.tipo === "devolucion_proveedor") {
    const salida = input.tipo === "merma" || input.tipo === "devolucion_proveedor" ? Math.abs(cantidad) : Math.abs(cantidad);
    if (!(salida > 0)) {
      throw new Error("La cantidad tiene que ser mayor que 0");
    }
    cantidad = roundCantidad(-salida);
    stockDespues = roundCantidad(antes.cantidad + cantidad);
  } else if (input.tipo === "ajuste") {
    if (cantidad === 0) {
      throw new Error("El ajuste no puede ser cero");
    }
    stockDespues = roundCantidad(antes.cantidad + cantidad);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("inventario_movimientos").insert({
    producto_id: input.productoId,
    tienda,
    tipo: input.tipo,
    cantidad,
    costo_unitario: input.tipo === "recepcion" ? costoUnitario : costoUnitario,
    stock_antes: antes.cantidad,
    stock_despues: stockDespues,
    costo_promedio_despues: costoPromedio,
    factura_id: input.facturaId ?? null,
    factura_linea_id: input.facturaLineaId ?? null,
    compra_id: input.compraId ?? null,
    origen: input.origen,
    nota: input.nota?.trim().slice(0, 500) || null,
  });
  if (error) {
    if (isUniqueViolation(error) && input.tipo === "recepcion") {
      return {
        yaExistia: true,
        stockAntes: antes.cantidad,
        stockDespues: antes.cantidad,
        costoPromedioDespues: antes.costoPromedio,
        ultimoCosto: antes.ultimoCosto,
      };
    }
    throw error;
  }
  if (cantidad === 0 && input.tipo === "conteo") {
    return {
      yaExistia: false,
      stockAntes: antes.cantidad,
      stockDespues,
      costoPromedioDespues: costoPromedio,
      ultimoCosto,
    };
  }
  await guardarStock(input.productoId, tienda, {
    cantidad: stockDespues,
    costoPromedio,
    ultimoCosto,
    puntoReorden: antes.puntoReorden,
  });
  return {
    yaExistia: false,
    stockAntes: antes.cantidad,
    stockDespues,
    costoPromedioDespues: costoPromedio,
    ultimoCosto,
  };
}

export async function guardarPuntoReorden(productoId: string, tiendaRaw: unknown, puntoReorden: number): Promise<Existencia | null> {
  if (!isInventarioUuid(productoId)) {
    throw new Error("No encontramos ese producto");
  }
  if (!Number.isFinite(puntoReorden) || puntoReorden < 0) {
    throw new Error("El punto de reorden no puede ser negativo");
  }
  const tienda = normalizarTienda(tiendaRaw);
  const antes = await leerStock(productoId, tienda);
  await guardarStock(productoId, tienda, { ...antes, puntoReorden: roundCantidad(puntoReorden) });
  const lista = await listarExistencias({ tienda, productoId, limit: 1 });
  return lista.existencias[0] ?? null;
}

type ProductoCampos = {
  nombre?: unknown;
  marca?: unknown;
  codigo_odoo?: unknown;
  codigo_barras?: unknown;
  precio?: unknown;
};

type ProductoEmbed = ProductoCampos | ProductoCampos[] | null;

function productoDe(embed: ProductoEmbed): { nombre: string; marca: string | null; codigoOdoo: string | null; codigoBarras: string | null; precio: number } {
  const row = Array.isArray(embed) ? embed[0] : embed;
  return {
    nombre: typeof row?.nombre === "string" ? row.nombre : "Producto",
    marca: typeof row?.marca === "string" && row.marca.trim() ? row.marca : null,
    codigoOdoo: typeof row?.codigo_odoo === "string" && row.codigo_odoo.trim() ? row.codigo_odoo : null,
    codigoBarras: typeof row?.codigo_barras === "string" && row.codigo_barras.trim() ? row.codigo_barras : null,
    precio: toMoney(row?.precio),
  };
}

export async function listarExistencias(input: {
  tienda: string;
  q?: string;
  bajoMinimo?: boolean;
  cursor?: string;
  productoId?: string;
  limit?: number;
}): Promise<{ existencias: Existencia[]; nextCursor: string | null }> {
  const tienda = normalizarTienda(input.tienda);
  const searching = Boolean((input.q ?? "").trim()) || Boolean(input.bajoMinimo);
  const limit = Math.min(searching ? 500 : INVENTARIO_PAGE_SIZE, Math.max(1, input.limit ?? (searching ? 500 : INVENTARIO_PAGE_SIZE)));
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("inventario_existencias")
    .select("producto_id, tienda, cantidad, costo_promedio, ultimo_costo, punto_reorden, products ( nombre, marca, codigo_odoo, codigo_barras, precio )")
    .eq("tienda", tienda)
    .order("producto_id", { ascending: true })
    .limit(limit + 1);
  if (input.cursor && isInventarioUuid(input.cursor)) {
    query = query.gt("producto_id", input.cursor);
  }
  if (input.productoId && isInventarioUuid(input.productoId)) {
    query = query.eq("producto_id", input.productoId);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const q = (input.q ?? "").trim().toLowerCase();
  const rows = (data ?? []).flatMap((row) => {
    const producto = productoDe(row.products as ProductoEmbed);
    const existencia: Existencia = {
      productoId: String(row.producto_id),
      nombre: producto.nombre,
      marca: producto.marca,
      codigoOdoo: producto.codigoOdoo,
      codigoBarras: producto.codigoBarras,
      precio: producto.precio,
      tienda: String(row.tienda),
      cantidad: roundCantidad(num(row.cantidad) ?? 0),
      costoPromedio: num(row.costo_promedio) == null ? null : roundCosto(num(row.costo_promedio) as number),
      ultimoCosto: num(row.ultimo_costo) == null ? null : roundCosto(num(row.ultimo_costo) as number),
      puntoReorden: roundCantidad(Math.max(0, num(row.punto_reorden) ?? 0)),
    };
    if (q) {
      const blob = [existencia.nombre, existencia.marca, existencia.codigoOdoo, existencia.codigoBarras].filter(Boolean).join(" ").toLowerCase();
      if (!blob.includes(q)) {
        return [];
      }
    }
    if (input.bajoMinimo && existencia.cantidad > existencia.puntoReorden) {
      return [];
    }
    return [existencia];
  });
  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1]?.productoId ?? null : null;
  return { existencias: page, nextCursor: next };
}

export async function existenciasPorProducto(productoIds: string[], tiendaRaw: unknown): Promise<Map<string, Existencia>> {
  const map = new Map<string, Existencia>();
  if (!productoIds.length) {
    return map;
  }
  const tienda = normalizarTienda(tiendaRaw);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("inventario_existencias")
    .select("producto_id, tienda, cantidad, costo_promedio, ultimo_costo, punto_reorden")
    .eq("tienda", tienda)
    .in("producto_id", productoIds);
  if (error) {
    throw error;
  }
  for (const row of data ?? []) {
    const productoId = String(row.producto_id);
    map.set(productoId, {
      productoId,
      nombre: "",
      marca: null,
      codigoOdoo: null,
      codigoBarras: null,
      precio: 0,
      tienda,
      cantidad: roundCantidad(num(row.cantidad) ?? 0),
      costoPromedio: num(row.costo_promedio) == null ? null : roundCosto(num(row.costo_promedio) as number),
      ultimoCosto: num(row.ultimo_costo) == null ? null : roundCosto(num(row.ultimo_costo) as number),
      puntoReorden: roundCantidad(Math.max(0, num(row.punto_reorden) ?? 0)),
    });
  }
  return map;
}

const TIPOS = new Set<InventarioMovimientoTipo>(["recepcion", "venta", "ajuste", "merma", "conteo", "devolucion_proveedor"]);

export async function listarMovimientos(input: {
  tienda: string;
  productoId?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
  cursor?: string;
}): Promise<{ movimientos: Movimiento[]; nextCursor: string | null }> {
  const tienda = normalizarTienda(input.tienda);
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("inventario_movimientos")
    .select(
      "id, producto_id, tienda, tipo, cantidad, costo_unitario, stock_antes, stock_despues, costo_promedio_despues, factura_id, factura_linea_id, compra_id, origen, nota, created_at, products ( nombre ), facturas ( numero_factura, ncf )"
    )
    .eq("tienda", tienda)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(INVENTARIO_PAGE_SIZE + 1);
  if (input.productoId && isInventarioUuid(input.productoId)) {
    query = query.eq("producto_id", input.productoId);
  }
  if (input.tipo && TIPOS.has(input.tipo as InventarioMovimientoTipo)) {
    query = query.eq("tipo", input.tipo);
  }
  if (input.desde && /^\d{4}-\d{2}-\d{2}$/.test(input.desde)) {
    query = query.gte("created_at", `${input.desde}T00:00:00.000Z`);
  }
  if (input.hasta && /^\d{4}-\d{2}-\d{2}$/.test(input.hasta)) {
    query = query.lte("created_at", `${input.hasta}T23:59:59.999Z`);
  }
  if (input.cursor) {
    query = query.lt("created_at", input.cursor);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const rows = data ?? [];
  const page = rows.slice(0, INVENTARIO_PAGE_SIZE);
  const movimientos = page.flatMap((row) => {
    const tipo = String(row.tipo);
    const origen = String(row.origen);
    if (!TIPOS.has(tipo as InventarioMovimientoTipo)) {
      return [];
    }
    const producto = Array.isArray(row.products) ? row.products[0] : row.products;
    const factura = Array.isArray(row.facturas) ? row.facturas[0] : row.facturas;
    const referencia =
      (factura && typeof factura === "object" && "ncf" in factura && typeof factura.ncf === "string" && factura.ncf) ||
      (factura && typeof factura === "object" && "numero_factura" in factura && typeof factura.numero_factura === "string" && factura.numero_factura) ||
      (typeof row.nota === "string" ? row.nota : null);
    const creadoEn = typeof row.created_at === "string" ? row.created_at : new Date().toISOString();
    return [
      {
        id: String(row.id),
        productoId: String(row.producto_id),
        productoNombre: producto && typeof producto === "object" && "nombre" in producto && typeof producto.nombre === "string" ? producto.nombre : null,
        tienda: String(row.tienda),
        tipo: tipo as InventarioMovimientoTipo,
        cantidad: roundCantidad(num(row.cantidad) ?? 0),
        costoUnitario: num(row.costo_unitario) == null ? null : roundCosto(num(row.costo_unitario) as number),
        stockAntes: roundCantidad(num(row.stock_antes) ?? 0),
        stockDespues: roundCantidad(num(row.stock_despues) ?? 0),
        costoPromedioDespues: num(row.costo_promedio_despues) == null ? null : roundCosto(num(row.costo_promedio_despues) as number),
        facturaId: typeof row.factura_id === "string" ? row.factura_id : null,
        facturaLineaId: typeof row.factura_linea_id === "string" ? row.factura_linea_id : null,
        compraId: typeof row.compra_id === "string" ? row.compra_id : null,
        origen: (origen === "admin" || origen === "pos" ? origen : "agente") as InventarioOrigen,
        nota: typeof row.nota === "string" ? row.nota : null,
        referencia,
        creadoEn,
      } satisfies Movimiento,
    ];
  });
  const next = rows.length > INVENTARIO_PAGE_SIZE ? movimientos[movimientos.length - 1]?.creadoEn ?? null : null;
  return { movimientos, nextCursor: next };
}

export async function lineasYaRecibidas(facturaId: string): Promise<Set<string>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("inventario_movimientos")
    .select("factura_linea_id")
    .eq("factura_id", facturaId)
    .eq("tipo", "recepcion");
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map((row) => String(row.factura_linea_id ?? "")).filter(Boolean));
}

export async function resolverProducto(input: {
  productoId?: unknown;
  codigoOdoo?: unknown;
  codigoBarras?: unknown;
}): Promise<{ id: string } | { error: string }> {
  const supabase = getSupabaseAdminClient();
  const productoId = typeof input.productoId === "string" ? input.productoId.trim() : "";
  if (productoId) {
    if (!isInventarioUuid(productoId)) {
      return { error: "producto no encontrado" };
    }
    const { data, error } = await supabase.from("products").select("id").eq("id", productoId).maybeSingle();
    if (error) {
      throw error;
    }
    return data?.id ? { id: String(data.id) } : { error: "producto no encontrado" };
  }
  const codigo = typeof input.codigoOdoo === "string" ? input.codigoOdoo.trim() : "";
  const barras = typeof input.codigoBarras === "string" ? input.codigoBarras.trim() : "";
  if (!codigo && !barras) {
    return { error: "sin producto" };
  }
  if (codigo) {
    const { data, error } = await supabase.from("products").select("id").eq("codigo_odoo", codigo).limit(2);
    if (error) {
      throw error;
    }
    if ((data ?? []).length > 1) {
      return { error: "codigo repetido" };
    }
    if (data?.[0]?.id) {
      return { id: String(data[0].id) };
    }
  }
  if (barras) {
    const { data, error } = await supabase.from("products").select("id").eq("codigo_barras", barras).limit(2);
    if (error) {
      throw error;
    }
    if ((data ?? []).length > 1) {
      return { error: "codigo repetido" };
    }
    if (data?.[0]?.id) {
      return { id: String(data[0].id) };
    }
  }
  return { error: "producto no encontrado" };
}

export async function publicarInventario(
  tipo: "inventario.recibido" | "inventario.vendido" | "inventario.ajustado",
  recurso: Record<string, unknown>
): Promise<void> {
  await publishAgentEvent(tipo, recurso);
}
