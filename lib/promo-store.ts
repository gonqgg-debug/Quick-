import { getSupabaseAdminClient } from "@/lib/supabase";
import { MilesError, hashPayload, mismoContenido } from "@/lib/miles-domain";
import { crearInvestigacion } from "@/lib/miles-store";
import {
  FORMULA_PROMO,
  calcularPromo,
  revisarAritmetica,
  supuestosVacios,
  type EntradaPromo,
  type LineaPromo,
  type ResultadoPromo,
  type SupuestosPromo,
} from "@/lib/promo-calculo";
import type { PropuestaInput } from "@/lib/promo-domain";

type Fila = Record<string, unknown>;

function client() {
  return getSupabaseAdminClient();
}

function fallar(error: { message?: string; code?: string } | null): never {
  if (error?.code === "23505") throw new MilesError(409, "Esa clave ya existe");
  const message = error?.message ?? "";
  if (/does not exist|schema cache|42P01/i.test(message)) throw new MilesError(503, "Falta aplicar la migración de propuestas");
  throw new MilesError(500, message || "No pudimos guardar");
}

async function evento(recursoId: string, actor: string, accion: string, detalle: Record<string, unknown>) {
  const { error } = await client().from("miles_eventos").insert({
    recurso_tipo: "propuesta",
    recurso_id: recursoId,
    actor,
    accion,
    detalle,
  });
  if (error) fallar(error);
}

export async function publicarPropuesta(input: PropuestaInput) {
  const payloadHash = hashPayload(input);
  const supabase = client();
  const previo = await supabase.from("miles_propuestas").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (previo.error) fallar(previo.error);
  if (previo.data) {
    if (!mismoContenido(String(previo.data.payload_hash), payloadHash)) throw new MilesError(409, "La misma clave llegó con otro contenido");
    return { row: previo.data, reintento: true };
  }
  const productos = await resolverProductos(input.productos);
  if (input.hallazgos.length > 0) {
    const hallazgos = await supabase.from("miles_hallazgos").select("id").in("id", input.hallazgos);
    if (hallazgos.error) fallar(hallazgos.error);
    if ((hallazgos.data ?? []).length !== input.hallazgos.length) throw new MilesError(400, "Hay un hallazgo que no existe");
  }
  if (input.investigacionId) {
    const investigacion = await supabase.from("miles_investigaciones").select("id").eq("id", input.investigacionId).maybeSingle();
    if (investigacion.error) fallar(investigacion.error);
    if (!investigacion.data) throw new MilesError(400, "Esa investigación no existe");
  }
  const insertado = await supabase
    .from("miles_propuestas")
    .insert({
      ejecucion_id: input.ejecucionId,
      investigacion_id: input.investigacionId,
      autor: "miles",
      idempotency_key: input.idempotencyKey,
      payload_hash: payloadHash,
      tienda: input.tienda,
      nombre: input.nombre,
      objetivo: input.objetivo,
      comportamiento: input.comportamiento,
      tipo: input.tipo,
      estado: input.estado,
      periodo_desde: input.periodoDesde,
      periodo_hasta: input.periodoHasta,
      mecanica: input.mecanica,
      metricas: input.metricas,
      limitaciones: input.limitaciones,
      evidencia: input.evidencia,
      costos: input.costos,
      supuestos: input.supuestos,
      escenarios: anotarEscenarios(input.escenarios),
      modelo: input.modelo,
      probabilidad: input.probabilidad,
      visual: input.visual,
      corte: input.corte,
    })
    .select("*")
    .single();
  if (insertado.error) fallar(insertado.error);
  const id = String(insertado.data.id);
  const lineas = await supabase.from("miles_propuesta_productos").insert(
    productos.map((producto, index) => ({
      propuesta_id: id,
      product_id: producto.productId,
      funcion: producto.funcion,
      cantidad: producto.cantidad,
      precio_habitual: producto.precioHabitual,
      precio_promo: producto.precioPromo,
      precio_observado_en: producto.precioObservadoEn,
      presentacion: producto.presentacion,
      orden: index,
    })),
  );
  if (lineas.error) {
    await supabase.from("miles_propuestas").delete().eq("id", id);
    fallar(lineas.error);
  }
  if (input.hallazgos.length > 0) {
    const vinculos = await supabase.from("miles_propuesta_hallazgos").insert(input.hallazgos.map((hallazgoId) => ({ propuesta_id: id, hallazgo_id: hallazgoId })));
    if (vinculos.error) {
      await supabase.from("miles_propuestas").delete().eq("id", id);
      fallar(vinculos.error);
    }
  }
  await evento(id, "miles", "publicacion", {});
  return { row: insertado.data, reintento: false };
}

export async function listarPropuestas() {
  const supabase = client();
  const propuestas = await supabase.from("miles_propuestas").select("*").order("publicado_en", { ascending: false }).limit(100);
  if (propuestas.error) fallar(propuestas.error);
  return enriquecer(propuestas.data ?? []);
}

export async function leerPropuesta(id: string): Promise<Fila | null> {
  const supabase = client();
  const propuesta = await supabase.from("miles_propuestas").select("*").eq("id", id).maybeSingle();
  if (propuesta.error) fallar(propuesta.error);
  if (!propuesta.data) return null;
  const [enriquecidas, variantes, eventos] = await Promise.all([
    enriquecer([propuesta.data]),
    supabase.from("miles_propuesta_variantes").select("*").eq("propuesta_id", id).order("creada_en", { ascending: true }),
    supabase.from("miles_eventos").select("*").eq("recurso_tipo", "propuesta").eq("recurso_id", id).order("en", { ascending: true }),
  ]);
  if (variantes.error) fallar(variantes.error);
  if (eventos.error) fallar(eventos.error);
  const fila: Fila = { ...enriquecidas[0], variantes: variantes.data ?? [], eventos: eventos.data ?? [] };
  return fila;
}

export async function corregirPropuestaMiles(id: string, version: number, patch: Record<string, unknown>) {
  const siguiente = { ...patch };
  if (Array.isArray(siguiente.escenarios)) siguiente.escenarios = anotarEscenarios(siguiente.escenarios);
  return cambiarPropuesta(id, version, siguiente, "miles", "correccion");
}

export async function cambiarPropuesta(id: string, version: number, patch: Record<string, unknown>, actor: string, accion: string) {
  const { data, error } = await client()
    .from("miles_propuestas")
    .update({ ...patch, actualizado_en: new Date().toISOString(), version: version + 1 })
    .eq("id", id)
    .eq("version", version)
    .select("*")
    .maybeSingle();
  if (error) fallar(error);
  if (!data) throw new MilesError(409, "La propuesta cambió. Vuelve a leerla.");
  await evento(id, actor, accion, patch);
  return data;
}

export async function guardarVariante(id: string, autor: string, body: Record<string, unknown>) {
  const propuesta = await leerPropuesta(id);
  if (!propuesta) throw new MilesError(404, "No está esa propuesta");
  const calculo = calcularDesde(propuesta, body);
  const nombre = typeof body.nombre === "string" && body.nombre.trim() ? body.nombre.trim().slice(0, 80) : "Variante";
  const { data, error } = await client()
    .from("miles_propuesta_variantes")
    .insert({
      propuesta_id: id,
      autor,
      nombre,
      mecanica: calculo.mecanica,
      supuestos: calculo.supuestos,
      lineas: calculo.lineas,
      resultado: calculo.resultado,
      formula: FORMULA_PROMO,
    })
    .select("*")
    .single();
  if (error) fallar(error);
  await evento(id, autor, "variante", { varianteId: data.id });
  return data;
}

export async function crearPruebaDePropuesta(id: string, autor: string, body: Record<string, unknown>) {
  const propuesta = await leerPropuesta(id);
  if (!propuesta) throw new MilesError(404, "No está esa propuesta");
  const hipotesis = texto(body.hipotesis, "La prueba necesita una hipótesis");
  const accion = texto(body.accion, "La prueba necesita una acción");
  const metrica = texto(body.metricaPrincipal, "La prueba necesita una métrica");
  let snapshot: Record<string, unknown>;
  let varianteId: string | null = null;
  if (typeof body.varianteId === "string") {
    const variante = (propuesta.variantes as Fila[]).find((item) => String(item.id) === body.varianteId);
    if (!variante) throw new MilesError(400, "Esa variante no es de esta propuesta");
    varianteId = String(variante.id);
    snapshot = congelar({
      formula: variante.formula,
      mecanica: variante.mecanica,
      supuestos: variante.supuestos,
      lineas: variante.lineas,
      resultado: variante.resultado,
      metricas: propuesta.metricas,
      corte: propuesta.corte,
      varianteId,
    });
  } else {
    const calculo = calcularDesde(propuesta, body);
    snapshot = congelar({ ...calculo, metricas: propuesta.metricas, corte: propuesta.corte, varianteId: null });
  }
  const hallazgos = propuesta.hallazgos as Fila[];
  const { data, error } = await client()
    .from("miles_pruebas")
    .insert({
      hallazgo_id: hallazgos[0] ? String(hallazgos[0].id) : null,
      propuesta_id: id,
      variante_id: varianteId,
      snapshot,
      hipotesis,
      accion,
      tienda: "quick",
      productos: (propuesta.productos as Fila[]).map((producto) => ({ productId: producto.productId, cantidad: producto.cantidad, funcion: producto.funcion })),
      responsable: typeof body.responsable === "string" ? body.responsable.slice(0, 80) : null,
      inicio_previsto: body.inicioPrevisto || null,
      fin_previsto: body.finPrevisto || null,
      metrica_principal: metrica,
      limitaciones: propuesta.limitaciones,
      estado: "propuesta",
    })
    .select("*")
    .single();
  if (error) fallar(error);
  await evento(id, autor, "prueba", { pruebaId: data.id });
  return data;
}

export async function pedirPropuestas(input: { pregunta: string; alcance: Record<string, unknown>; solicitante: string; hallazgoId: string | null }) {
  return crearInvestigacion({
    hallazgoId: input.hallazgoId,
    tipo: "investigacion",
    pregunta: input.pregunta,
    alcance: { ...input.alcance, solicitud: "propuestas" },
    solicitante: input.solicitante,
  });
}

async function resolverProductos(productos: PropuestaInput["productos"]) {
  const supabase = client();
  const ids = productos.flatMap((producto) => (producto.productId ? [producto.productId] : []));
  const codigos = productos.flatMap((producto) => (producto.codigoOdoo ? [producto.codigoOdoo] : []));
  const [porId, porCodigo] = await Promise.all([
    ids.length ? supabase.from("products").select("id, codigo_odoo").in("id", ids) : Promise.resolve({ data: [], error: null }),
    codigos.length ? supabase.from("products").select("id, codigo_odoo").in("codigo_odoo", codigos) : Promise.resolve({ data: [], error: null }),
  ]);
  if (porId.error) fallar(porId.error);
  if (porCodigo.error) fallar(porCodigo.error);
  const catalogo = [...(porId.data ?? []), ...(porCodigo.data ?? [])];
  return productos.map((producto) => {
    const hallado = catalogo.find((item) => (producto.productId && item.id === producto.productId) || (producto.codigoOdoo && item.codigo_odoo === producto.codigoOdoo));
    if (!hallado) throw new MilesError(400, "Hay un producto que no está en el catálogo");
    return { ...producto, productId: String(hallado.id) };
  });
}

async function enriquecer(propuestas: Fila[]): Promise<Fila[]> {
  if (propuestas.length === 0) return [];
  const supabase = client();
  const ids = propuestas.map((row) => String(row.id));
  const [productos, vinculos, pruebas] = await Promise.all([
    supabase.from("miles_propuesta_productos").select("*").in("propuesta_id", ids).order("orden", { ascending: true }),
    supabase.from("miles_propuesta_hallazgos").select("propuesta_id, hallazgo_id").in("propuesta_id", ids),
    supabase.from("miles_pruebas").select("id, propuesta_id, estado, hipotesis, metrica_principal, version").in("propuesta_id", ids),
  ]);
  if (productos.error) fallar(productos.error);
  if (vinculos.error) fallar(vinculos.error);
  if (pruebas.error) fallar(pruebas.error);
  const productIds = Array.from(new Set((productos.data ?? []).map((row) => String(row.product_id))));
  const hallazgoIds = Array.from(new Set((vinculos.data ?? []).map((row) => String(row.hallazgo_id))));
  const pruebaIds = (pruebas.data ?? []).map((row) => String(row.id));
  const [catalogo, costos, conteos, resumen, hallazgos, evaluaciones] = await Promise.all([
    productIds.length ? supabase.from("products").select("id, nombre, foto_url, precio, categoria, tasa_itbis, codigo_odoo").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    productIds.length ? supabase.from("costo_producto_vigente").select("product_id, costo_unit, origen, fecha, ref").in("product_id", productIds) : Promise.resolve({ data: [], error: null }),
    productIds.length ? supabase.from("inventario_conteos").select("product_id, cantidad, fecha").in("product_id", productIds).order("fecha", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    productIds.length ? supabase.from("resumen_producto_dia").select("product_id, fecha, unidades, venta, n_ordenes").in("product_id", productIds) : Promise.resolve({ data: [], error: null }),
    hallazgoIds.length ? supabase.from("miles_hallazgos").select("id, titulo, tipo, estado, periodo_desde, periodo_hasta").in("id", hallazgoIds) : Promise.resolve({ data: [], error: null }),
    pruebaIds.length ? supabase.from("miles_evaluaciones").select("id, prueba_id, creado_en").in("prueba_id", pruebaIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const resultado of [catalogo, hallazgos, evaluaciones]) {
    if (resultado.error) fallar(resultado.error);
  }
  const costoFilas = costos.error ? [] : costos.data ?? [];
  const conteoFilas = conteos.error ? [] : conteos.data ?? [];
  const resumenFilas = resumen.error ? [] : resumen.data ?? [];
  return propuestas.map((propuesta) => {
    const propias = (productos.data ?? []).filter((row) => String(row.propuesta_id) === String(propuesta.id));
    const susPruebas = (pruebas.data ?? []).filter((row) => String(row.propuesta_id) === String(propuesta.id));
    const susEvaluaciones = (evaluaciones.data ?? []).filter((row) => susPruebas.some((prueba) => String(prueba.id) === String(row.prueba_id)));
    const fila: Fila = {
      ...propuesta,
      productos: propias.map((linea) => productoEnriquecido(linea, propuesta, catalogo.data ?? [], costoFilas, conteoFilas, resumenFilas)),
      hallazgos: (hallazgos.data ?? []).filter((row) => (vinculos.data ?? []).some((vinculo) => String(vinculo.propuesta_id) === String(propuesta.id) && String(vinculo.hallazgo_id) === String(row.id))),
      pruebas: susPruebas,
      evaluaciones: susEvaluaciones,
    };
    return fila;
  });
}

function productoEnriquecido(linea: Fila, propuesta: Fila, catalogo: Fila[], costos: Fila[], conteos: Fila[], resumen: Fila[]) {
  const producto = catalogo.find((item) => String(item.id) === String(linea.product_id));
  const costo = costos.find((item) => String(item.product_id) === String(linea.product_id));
  const conteo = conteos.find((item) => String(item.product_id) === String(linea.product_id));
  const ventas = resumen.filter((item) => {
    if (String(item.product_id) !== String(linea.product_id)) return false;
    const fecha = String(item.fecha).slice(0, 10);
    return fecha >= String(propuesta.periodo_desde) && fecha <= String(propuesta.periodo_hasta);
  });
  return {
    ...linea,
    productId: String(linea.product_id),
    nombre: producto ? String(producto.nombre) : "Producto no disponible",
    fotoUrl: producto?.foto_url ? String(producto.foto_url) : null,
    categoria: producto?.categoria ? String(producto.categoria) : null,
    precioActual: producto && producto.precio != null ? Number(producto.precio) : null,
    tasa: producto && (producto.tasa_itbis === 0 || producto.tasa_itbis === 16 || producto.tasa_itbis === 18) ? Number(producto.tasa_itbis) : null,
    costoActual: costo && costo.costo_unit != null ? Number(costo.costo_unit) : null,
    costoOrigen: costo?.origen ? String(costo.origen) : null,
    costoFecha: costo?.fecha ? String(costo.fecha) : null,
    costoRef: costo?.ref ? String(costo.ref) : null,
    existencias: conteo && conteo.cantidad != null ? Number(conteo.cantidad) : null,
    existenciasFecha: conteo?.fecha ? String(conteo.fecha).slice(0, 10) : null,
    ventasPeriodo: ventas.length === 0 ? null : ventas.reduce((total, item) => total + Number(item.venta ?? 0), 0),
    unidadesPeriodo: ventas.length === 0 ? null : ventas.reduce((total, item) => total + Number(item.unidades ?? 0), 0),
    ticketsPeriodo: ventas.length === 0 ? null : ventas.reduce((total, item) => total + Number(item.n_ordenes ?? 0), 0),
  };
}

function calcularDesde(propuesta: Fila, body: Record<string, unknown>): { mecanica: Record<string, unknown>; supuestos: SupuestosPromo; lineas: LineaPromo[]; resultado: ResultadoPromo } {
  const editadas = Array.isArray(body.lineas) ? body.lineas : [];
  const lineas: LineaPromo[] = (propuesta.productos as Fila[]).map((producto) => {
    const edicion = editadas.find((item) => item && typeof item === "object" && String((item as Fila).productId) === String(producto.productId)) as Fila | undefined;
    const cantidad = edicion && typeof edicion.cantidad === "number" && edicion.cantidad > 0 ? edicion.cantidad : Number(producto.cantidad);
    const precioHabitual = producto.precio_habitual != null ? Number(producto.precio_habitual) : producto.precioActual != null ? Number(producto.precioActual) : Number.NaN;
    const precioPromo = edicion && (edicion.precioPromo === null || typeof edicion.precioPromo === "number") ? (edicion.precioPromo as number | null) : producto.precio_promo != null ? Number(producto.precio_promo) : null;
    return {
      productId: String(producto.productId),
      cantidad,
      precioHabitual,
      precioPromo,
      costo: producto.costoActual == null ? null : Number(producto.costoActual),
      tasa: producto.tasa == null ? null : Number(producto.tasa),
    };
  });
  if (lineas.some((linea) => !Number.isFinite(linea.precioHabitual)) ) {
    throw new MilesError(400, "Falta el precio habitual de un producto");
  }
  const mecanica = body.mecanica && typeof body.mecanica === "object" && !Array.isArray(body.mecanica) ? (body.mecanica as Record<string, unknown>) : {};
  const supuestos = leerSupuestos(body.supuestos);
  const entrada: EntradaPromo = {
    tipo: String(propuesta.tipo) as EntradaPromo["tipo"],
    lineas,
    precioCombo: numero(mecanica.precioCombo),
    descuento: numero(mecanica.descuento),
    supuestos,
  };
  return { mecanica, supuestos, lineas, resultado: calcularPromo(entrada) };
}

function leerSupuestos(value: unknown): SupuestosPromo {
  const base = supuestosVacios();
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const raw = value as Record<string, unknown>;
  const leer = (campo: keyof SupuestosPromo, max = 1_000_000) => {
    const numeroValor = raw[campo];
    if (numeroValor == null || numeroValor === "") return null;
    if (typeof numeroValor !== "number" || !Number.isFinite(numeroValor) || numeroValor < 0 || numeroValor > max) {
      throw new MilesError(400, "Hay un supuesto que no es un número válido");
    }
    return numeroValor;
  };
  const adopcion = leer("adopcion", 1);
  const sustitucion = leer("sustitucion", 1);
  const conservador = leer("conservador", 1);
  const favorable = leer("favorable", 1);
  return {
    ticketsElegibles: leer("ticketsElegibles"),
    yaCompraban: leer("yaCompraban"),
    adopcion,
    sustitucion,
    costoBeneficio: leer("costoBeneficio"),
    margenIncrementalUmbral: leer("margenIncrementalUmbral"),
    conservador,
    favorable,
  };
}

function anotarEscenarios(escenarios: unknown[]) {
  return escenarios.map((escenario) => {
    if (!escenario || typeof escenario !== "object" || Array.isArray(escenario)) return escenario;
    return revisarAritmetica(escenario as Record<string, unknown>);
  });
}

function congelar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

function numero(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new MilesError(400, "Hay un precio que no es un número");
  return value;
}

function texto(value: unknown, mensaje: string): string {
  if (typeof value !== "string" || value.trim().length < 3) throw new MilesError(400, mensaje);
  return value.trim();
}
