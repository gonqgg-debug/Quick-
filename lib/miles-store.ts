import { createHash, randomBytes } from "node:crypto";
import { elegirDestacados, prepararHallazgo, type HallazgoDestacado } from "@/lib/consumo-resumen-ui";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  MILES_NOMBRE,
  MILES_ROL,
  MilesError,
  hashHallazgo,
  hashPayload,
  mismoContenido,
  type HallazgoInput,
} from "@/lib/miles-domain";
import { hashAsociacion, hashInforme, type AsociacionInput, type InformeInput, type TareaInput } from "@/lib/miles-publicacion";

function client() {
  return getSupabaseAdminClient();
}

function fallar(error: { message?: string; code?: string } | null): never {
  if (error?.code === "23505") {
    throw new MilesError(409, "Esa clave ya existe");
  }
  const message = error?.message ?? "";
  if (/does not exist|schema cache|42P01/i.test(message)) {
    throw new MilesError(503, "Falta aplicar la migración de Miles");
  }
  throw new MilesError(500, message || "No pudimos guardar");
}

async function evento(recursoTipo: string, recursoId: string, actor: string, accion: string, detalle: Record<string, unknown>) {
  const { error } = await client().from("miles_eventos").insert({
    recurso_tipo: recursoTipo,
    recurso_id: recursoId,
    actor,
    accion,
    detalle,
  });
  if (error) {
    fallar(error);
  }
}

export async function emitirTokenMiles(): Promise<{ token: string; prefijo: string; id: string }> {
  const token = `qk_miles_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const prefijo = token.slice(0, 16);
  const supabase = client();
  const activos = await supabase.from("agent_credenciales").select("id").eq("rol", MILES_ROL).is("revocado_en", null);
  if (activos.error) {
    fallar(activos.error);
  }
  const ahora = new Date().toISOString();
  if ((activos.data ?? []).length > 0) {
    const revocar = await supabase
      .from("agent_credenciales")
      .update({ revocado_en: ahora })
      .eq("rol", MILES_ROL)
      .is("revocado_en", null);
    if (revocar.error) {
      fallar(revocar.error);
    }
  }
  const insertado = await supabase
    .from("agent_credenciales")
    .insert({
      rol: MILES_ROL,
      nombre: MILES_NOMBRE,
      token_hash: tokenHash,
      prefijo,
      reemplaza_id: activos.data?.[0]?.id ?? null,
    })
    .select("id, prefijo")
    .single();
  if (insertado.error) {
    fallar(insertado.error);
  }
  return { token, prefijo: String(insertado.data.prefijo), id: String(insertado.data.id) };
}

export async function revocarTokenMiles(id: string) {
  const { error } = await client()
    .from("agent_credenciales")
    .update({ revocado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("rol", MILES_ROL)
    .is("revocado_en", null);
  if (error) {
    fallar(error);
  }
}

export async function rolPorTokenHash(token: string): Promise<"miles" | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await client()
    .from("agent_credenciales")
    .select("rol")
    .eq("token_hash", tokenHash)
    .is("revocado_en", null)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data.rol === "miles" ? "miles" : null;
}

export async function credencialMilesActiva(): Promise<{ id: string; prefijo: string; creadoEn: string } | null> {
  const { data, error } = await client()
    .from("agent_credenciales")
    .select("id, prefijo, creado_en")
    .eq("rol", MILES_ROL)
    .is("revocado_en", null)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return { id: String(data.id), prefijo: String(data.prefijo), creadoEn: String(data.creado_en) };
}

export async function abrirEjecucion(input: { idempotencyKey: string; datosHasta: string | null; corte: string | null }) {
  const payload = { datosHasta: input.datosHasta, corte: input.corte };
  const payloadHash = hashPayload(payload);
  const supabase = client();
  const previo = await supabase.from("miles_ejecuciones").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (previo.error) fallar(previo.error);
  if (previo.data) {
    if (!mismoContenido(String(previo.data.payload_hash), payloadHash)) {
      throw new MilesError(409, "La misma clave llegó con otro contenido");
    }
    return { row: previo.data, reintento: true };
  }
  const insertado = await supabase
    .from("miles_ejecuciones")
    .insert({
      idempotency_key: input.idempotencyKey,
      payload_hash: payloadHash,
      datos_hasta: input.datosHasta,
      corte: input.corte,
      estado: "en_curso",
    })
    .select("*")
    .single();
  if (insertado.error) {
    if (insertado.error.code === "23505") {
      return abrirEjecucion(input);
    }
    fallar(insertado.error);
  }
  await evento("ejecucion", String(insertado.data.id), MILES_ROL, "inicio", {});
  return { row: insertado.data, reintento: false };
}

export async function leerEjecucion(id: string) {
  const { data, error } = await client()
    .from("miles_ejecuciones")
    .select("id, estado, version, iniciada_en, terminada_en, datos_hasta, corte, error")
    .eq("id", id)
    .maybeSingle();
  if (error) fallar(error);
  return data;
}

export async function cerrarEjecucion(
  id: string,
  input: { version: number; estado: "completada" | "fallida" | "parcial"; error: string | null; datosHasta: string | null; corte: string | null },
) {
  const patch: Record<string, unknown> = {
    estado: input.estado,
    error: input.error,
    terminada_en: new Date().toISOString(),
    version: input.version + 1,
  };
  if (input.datosHasta) patch.datos_hasta = input.datosHasta;
  if (input.corte) patch.corte = input.corte;
  const { data, error } = await client()
    .from("miles_ejecuciones")
    .update(patch)
    .eq("id", id)
    .eq("version", input.version)
    .select("*")
    .maybeSingle();
  if (error) fallar(error);
  if (!data) {
    throw new MilesError(409, "La ejecución cambió. Vuelve a leerla.");
  }
  await evento("ejecucion", id, MILES_ROL, input.estado, {});
  return data;
}

function filaHallazgo(input: HallazgoInput, payloadHash: string) {
  return {
    ejecucion_id: input.ejecucionId,
    payload_hash: payloadHash,
    patron_clave: input.patronClave,
    tipo: input.tipo,
    titulo: input.titulo,
    resumen: input.resumen,
    observacion: input.observacion,
    interpretacion: input.interpretacion,
    recomendacion: input.recomendacion,
    prioridad: input.prioridad,
    prioridad_justificacion: input.prioridadJustificacion,
    tienda: input.tienda,
    alcance: input.alcance,
    periodo_desde: input.periodoDesde,
    periodo_hasta: input.periodoHasta,
    comparacion_desde: input.comparacionDesde,
    comparacion_hasta: input.comparacionHasta,
    comparacion_modo: input.comparacionModo,
    metricas: input.metricas,
    muestras: input.muestras,
    limitaciones: input.limitaciones,
    evidencia: input.evidencia,
    corte: input.corte,
    hipotesis: input.hipotesis,
    proximo_paso: input.proximoPaso,
    validado_en: new Date().toISOString(),
    ...(input.visual ? { visual: input.visual } : {}),
    ...(input.grafica ? { grafica: input.grafica } : {}),
    actualizado_en: new Date().toISOString(),
  };
}

export async function publicarHallazgo(input: HallazgoInput) {
  const payloadHash = hashHallazgo(input);
  const supabase = client();
  const previo = await supabase.from("miles_hallazgos").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (previo.error) fallar(previo.error);
  if (previo.data) {
    if (!mismoContenido(String(previo.data.payload_hash), payloadHash)) {
      throw new MilesError(409, "La misma clave llegó con otro contenido");
    }
    return { row: previo.data, reintento: true };
  }
  if (input.patronClave) {
    const anterior = await supabase
      .from("miles_hallazgos")
      .select("*")
      .eq("patron_clave", input.patronClave)
      .eq("tienda", input.tienda)
      .order("publicado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anterior.error) fallar(anterior.error);
    if (anterior.data) {
      if (mismoContenido(String(anterior.data.payload_hash), payloadHash)) {
        return { row: anterior.data, reintento: true };
      }
      const actualizado = await supabase
        .from("miles_hallazgos")
        .update({ ...filaHallazgo(input, payloadHash), version: Number(anterior.data.version ?? 1) + 1 })
        .eq("id", anterior.data.id)
        .select("*")
        .single();
      if (actualizado.error) fallar(actualizado.error);
      await evento("hallazgo", String(anterior.data.id), MILES_ROL, "actualizacion", {
        titulo: anterior.data.titulo,
        resumen: anterior.data.resumen,
        periodo_desde: anterior.data.periodo_desde,
        periodo_hasta: anterior.data.periodo_hasta,
        metricas: anterior.data.metricas,
        estado: anterior.data.estado,
      });
      return { row: actualizado.data, reintento: false };
    }
  }
  const insertado = await supabase
    .from("miles_hallazgos")
    .insert({
      ...filaHallazgo(input, payloadHash),
      autor: MILES_ROL,
      idempotency_key: input.idempotencyKey,
      hallazgo_previo_id: null,
    })
    .select("*")
    .single();
  if (insertado.error) {
    if (insertado.error.code === "23505") {
      return publicarHallazgo(input);
    }
    fallar(insertado.error);
  }
  await evento("hallazgo", String(insertado.data.id), MILES_ROL, "publicacion", {});
  return { row: insertado.data, reintento: false };
}

export async function listarHallazgos(filtros: {
  tienda?: string | null;
  tipo?: string | null;
  estado?: string | null;
  prioridad?: string | null;
  desde?: string | null;
  hasta?: string | null;
  limit: number;
  cursor: string | null;
}) {
  let query = client().from("miles_hallazgos").select("*").order("publicado_en", { ascending: false }).order("id", { ascending: false }).limit(filtros.limit);
  if (filtros.tienda) query = query.eq("tienda", filtros.tienda);
  if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
  if (filtros.estado) query = query.eq("estado", filtros.estado);
  if (filtros.prioridad) query = query.eq("prioridad", filtros.prioridad);
  if (filtros.desde) query = query.gte("periodo_hasta", filtros.desde);
  if (filtros.hasta) query = query.lte("periodo_desde", filtros.hasta);
  if (filtros.cursor) query = query.lt("publicado_en", filtros.cursor);
  const { data, error } = await query;
  if (error) fallar(error);
  return data ?? [];
}

export async function leerHallazgo(id: string) {
  const supabase = client();
  const hallazgo = await supabase.from("miles_hallazgos").select("*").eq("id", id).maybeSingle();
  if (hallazgo.error) fallar(hallazgo.error);
  if (!hallazgo.data) return null;
  const [eventos, comentarios, investigaciones] = await Promise.all([
    supabase.from("miles_eventos").select("*").eq("recurso_tipo", "hallazgo").eq("recurso_id", id).order("en", { ascending: true }),
    supabase.from("miles_comentarios").select("*").eq("recurso_tipo", "hallazgo").eq("recurso_id", id).order("creado_en", { ascending: true }),
    supabase.from("miles_investigaciones").select("*").eq("hallazgo_id", id).order("creada_en", { ascending: true }),
  ]);
  if (eventos.error) fallar(eventos.error);
  if (comentarios.error) fallar(comentarios.error);
  if (investigaciones.error) fallar(investigaciones.error);
  return { hallazgo: hallazgo.data, eventos: eventos.data ?? [], comentarios: comentarios.data ?? [], investigaciones: investigaciones.data ?? [] };
}

export async function listarEjecuciones(limit = 20) {
  const { data, error } = await client().from("miles_ejecuciones").select("*").order("iniciada_en", { ascending: false }).limit(limit);
  if (error) fallar(error);
  return data ?? [];
}

export async function crearInvestigacion(input: {
  hallazgoId: string | null;
  tipo: "investigacion" | "ampliacion";
  pregunta: string;
  alcance: Record<string, unknown>;
  solicitante: string;
}) {
  const { data, error } = await client()
    .from("miles_investigaciones")
    .insert({
      hallazgo_id: input.hallazgoId,
      tipo: input.tipo,
      pregunta: input.pregunta,
      alcance: input.alcance,
      solicitante: input.solicitante,
      estado: "pendiente",
    })
    .select("*")
    .single();
  if (error) fallar(error);
  await evento("investigacion", String(data.id), input.solicitante, "solicitud", { tipo: input.tipo });
  return data;
}

export async function listarInvestigaciones(estado: string | null, limit: number) {
  let query = client().from("miles_investigaciones").select("*").order("creada_en", { ascending: true }).limit(limit);
  if (estado) query = query.eq("estado", estado);
  const { data, error } = await query;
  if (error) fallar(error);
  return data ?? [];
}

export async function avanzarInvestigacion(id: string, input: { version: number; estado: string; respuesta: string | null }) {
  const patch: Record<string, unknown> = {
    estado: input.estado,
    respuesta: input.respuesta,
    actualizado_en: new Date().toISOString(),
    version: input.version + 1,
  };
  if (input.estado === "en_analisis") {
    patch.tomada_en = new Date().toISOString();
  }
  const { data, error } = await client()
    .from("miles_investigaciones")
    .update(patch)
    .eq("id", id)
    .eq("version", input.version)
    .select("*")
    .maybeSingle();
  if (error) fallar(error);
  if (!data) throw new MilesError(409, "La investigación cambió. Vuelve a leerla.");
  await evento("investigacion", id, MILES_ROL, input.estado, {});
  return data;
}

export async function crearPrueba(input: Record<string, unknown>, solicitante: string) {
  const { data, error } = await client()
    .from("miles_pruebas")
    .insert({ ...input, estado: "propuesta" })
    .select("*")
    .single();
  if (error) fallar(error);
  await evento("prueba", String(data.id), solicitante, "propuesta", {});
  return data;
}

export async function listarPruebas(estado: string | null) {
  let query = client().from("miles_pruebas").select("*").order("creada_en", { ascending: false }).limit(100);
  if (estado) query = query.eq("estado", estado);
  const { data, error } = await query;
  if (error) fallar(error);
  return data ?? [];
}

export async function transicionarPrueba(id: string, version: number, estado: string, extra: Record<string, unknown>, actor: string) {
  const { data, error } = await client()
    .from("miles_pruebas")
    .update({ estado, ...extra, actualizado_en: new Date().toISOString(), version: version + 1 })
    .eq("id", id)
    .eq("version", version)
    .select("*")
    .maybeSingle();
  if (error) fallar(error);
  if (!data) throw new MilesError(409, "La prueba cambió. Vuelve a leerla.");
  await evento("prueba", id, actor, estado, extra);
  return data;
}

export async function publicarEvaluacion(pruebaId: string, input: {
  idempotencyKey: string;
  observacion: string;
  atribucion: string | null;
  metricas: Record<string, unknown>;
  limitaciones: string | null;
  ejecucionId: string | null;
}) {
  const payloadHash = hashPayload(input);
  const supabase = client();
  const previo = await supabase.from("miles_evaluaciones").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (previo.error) fallar(previo.error);
  if (previo.data) {
    if (!mismoContenido(String(previo.data.payload_hash), payloadHash) || String(previo.data.prueba_id) !== pruebaId) {
      throw new MilesError(409, "La misma clave llegó con otro contenido");
    }
    return { row: previo.data, reintento: true };
  }
  const prueba = await supabase.from("miles_pruebas").select("id, estado").eq("id", pruebaId).maybeSingle();
  if (prueba.error) fallar(prueba.error);
  if (!prueba.data) throw new MilesError(404, "No está esa prueba");
  const insertado = await supabase
    .from("miles_evaluaciones")
    .insert({
      prueba_id: pruebaId,
      ejecucion_id: input.ejecucionId,
      autor: MILES_ROL,
      observacion: input.observacion,
      atribucion: input.atribucion,
      metricas: input.metricas,
      limitaciones: input.limitaciones,
      idempotency_key: input.idempotencyKey,
      payload_hash: payloadHash,
    })
    .select("*")
    .single();
  if (insertado.error) {
    if (insertado.error.code === "23505") return publicarEvaluacion(pruebaId, input);
    fallar(insertado.error);
  }
  await evento("prueba", pruebaId, MILES_ROL, "evaluacion", { evaluacionId: insertado.data.id });
  return { row: insertado.data, reintento: false };
}

export async function cambiarHallazgo(id: string, version: number, patch: Record<string, unknown>, actor: string, accion: string) {
  const { data, error } = await client()
    .from("miles_hallazgos")
    .update({ ...patch, actualizado_en: new Date().toISOString(), version: version + 1 })
    .eq("id", id)
    .eq("version", version)
    .select("*")
    .maybeSingle();
  if (error) fallar(error);
  if (!data) throw new MilesError(409, "El hallazgo cambió. Vuelve a leerlo.");
  await evento("hallazgo", id, actor, accion, patch);
  return data;
}

export async function destacadosMiles(ventana: { desde: string; hasta: string }): Promise<{ destacados: HallazgoDestacado[]; recomendaciones: number }> {
  const supabase = client();
  const campos =
    "id, titulo, tipo, resumen, periodo_desde, periodo_hasta, publicado_en, actualizado_en, visual, metricas, evidencia, estado, resolucion, recomendacion_estado, recomendacion, limitaciones";
  const [hallazgos, recomendaciones] = await Promise.all([
    supabase.from("miles_hallazgos").select(campos).eq("estado", "vigente").order("publicado_en", { ascending: false }).limit(24),
    supabase.from("miles_hallazgos").select("id", { count: "exact", head: true }).eq("estado", "vigente").not("recomendacion", "is", null),
  ]);
  if (hallazgos.error) fallar(hallazgos.error);
  if (recomendaciones.error) fallar(recomendaciones.error);
  const preparados = ((hallazgos.data ?? []) as Record<string, unknown>[])
    .map((row) => prepararHallazgo(row, ventana))
    .filter((row): row is HallazgoDestacado => row != null);
  return { destacados: elegirDestacados(preparados), recomendaciones: recomendaciones.count ?? 0 };
}

export async function resumenMiles() {
  const supabase = client();
  const [hallazgos, recomendaciones, ultima] = await Promise.all([
    supabase.from("miles_hallazgos").select("id, titulo, tipo, prioridad, resumen, periodo_desde, periodo_hasta").eq("estado", "vigente").order("publicado_en", { ascending: false }).limit(3),
    supabase.from("miles_hallazgos").select("id", { count: "exact", head: true }).eq("estado", "vigente").not("recomendacion", "is", null),
    supabase.from("miles_ejecuciones").select("estado, terminada_en, datos_hasta").order("iniciada_en", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (hallazgos.error) fallar(hallazgos.error);
  return {
    hallazgos: hallazgos.data ?? [],
    recomendaciones: recomendaciones.count ?? 0,
    ultima: ultima.data ?? null,
  };
}

export async function comentar(input: { recursoTipo: string; recursoId: string; autor: string; cuerpo: string }) {
  const { data, error } = await client()
    .from("miles_comentarios")
    .insert({
      recurso_tipo: input.recursoTipo,
      recurso_id: input.recursoId,
      autor: input.autor,
      autor_rol: "humano",
      cuerpo: input.cuerpo,
    })
    .select("*")
    .single();
  if (error) fallar(error);
  await evento(input.recursoTipo, input.recursoId, input.autor, "comentario", {});
  return data;
}

export async function publicarInforme(input: InformeInput) {
  const payloadHash = hashInforme(input);
  const supabase = client();
  const previo = await supabase.from("miles_informes").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (previo.error) fallar(previo.error);
  if (previo.data) {
    if (!mismoContenido(String(previo.data.payload_hash), payloadHash)) throw new MilesError(409, "La misma clave llegó con otro contenido");
    return { row: previo.data, reintento: true };
  }
  const hallazgos = input.casos.length
    ? await supabase.from("miles_hallazgos").select("id, titulo, resumen, estado, tipo, prioridad, grafica").in("id", input.casos)
    : { data: [], error: null };
  if (hallazgos.error) fallar(hallazgos.error);
  if ((hallazgos.data ?? []).length !== input.casos.length) throw new MilesError(400, "Un caso del informe no existe");
  const insertado = await supabase
    .from("miles_informes")
    .insert({
      fecha: input.fecha,
      ejecucion_id: input.ejecucionId,
      estado: input.estado,
      conclusion: input.conclusion,
      novedades: input.novedades,
      actualizaciones: input.actualizaciones,
      bloqueos: input.bloqueos,
      trabajo: input.trabajo,
      datos_hasta: input.datosHasta,
      idempotency_key: input.idempotencyKey,
      payload_hash: payloadHash,
    })
    .select("*")
    .single();
  if (insertado.error) {
    if (insertado.error.code === "23505") return publicarInforme(input);
    fallar(insertado.error);
  }
  if ((hallazgos.data ?? []).length > 0) {
    const casos = (hallazgos.data ?? []).map((row, index) => ({
      informe_id: insertado.data.id,
      hallazgo_id: row.id,
      orden: input.casos.indexOf(String(row.id)) >= 0 ? input.casos.indexOf(String(row.id)) : index,
      titulo: row.titulo,
      conclusion: row.resumen,
      estado_en_publicacion: row.estado,
      tipo: row.tipo,
      prioridad: row.prioridad,
      grafica: row.grafica,
    }));
    const ligadura = await supabase.from("miles_informe_casos").insert(casos);
    if (ligadura.error) {
      await supabase.from("miles_informes").delete().eq("id", insertado.data.id);
      fallar(ligadura.error);
    }
  }
  await evento("informe", String(insertado.data.id), MILES_ROL, "publicacion", { fecha: input.fecha });
  return { row: insertado.data, reintento: false };
}

export async function listarInformes(limit = 30) {
  const { data, error } = await client().from("miles_informes").select("*").order("fecha", { ascending: false }).order("publicado_en", { ascending: false }).limit(limit);
  if (error) fallar(error);
  return data ?? [];
}

export async function casosDeInforme(informeId: string) {
  const { data, error } = await client().from("miles_informe_casos").select("*").eq("informe_id", informeId).order("orden", { ascending: true });
  if (error) fallar(error);
  return data ?? [];
}

export async function publicarAsociacion(input: AsociacionInput) {
  const payloadHash = hashAsociacion(input);
  const supabase = client();
  const previo = await supabase.from("miles_asociaciones").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (previo.error) fallar(previo.error);
  if (previo.data) {
    if (!mismoContenido(String(previo.data.payload_hash), payloadHash)) {
      const actualizado = await supabase
        .from("miles_asociaciones")
        .update({
          ...filaAsociacion(input),
          payload_hash: payloadHash,
          version: Number(previo.data.version ?? 1) + 1,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", previo.data.id)
        .select("*")
        .single();
      if (actualizado.error) fallar(actualizado.error);
      await evento("asociacion", String(previo.data.id), MILES_ROL, "actualizacion", { n_ab: previo.data.n_ab, observacion: previo.data.observacion });
      return { row: actualizado.data, reintento: false };
    }
    return { row: previo.data, reintento: true };
  }
  const par = await supabase
    .from("miles_asociaciones")
    .select("*")
    .eq("codigo_a", input.codigoA)
    .eq("codigo_b", input.codigoB)
    .eq("periodo_desde", input.periodoDesde)
    .eq("periodo_hasta", input.periodoHasta)
    .maybeSingle();
  if (par.error) fallar(par.error);
  if (par.data) {
    const actualizado = await supabase
      .from("miles_asociaciones")
      .update({ ...filaAsociacion(input), payload_hash: payloadHash, version: Number(par.data.version ?? 1) + 1, actualizado_en: new Date().toISOString() })
      .eq("id", par.data.id)
      .select("*")
      .single();
    if (actualizado.error) fallar(actualizado.error);
    await evento("asociacion", String(par.data.id), MILES_ROL, "actualizacion", { clave: input.idempotencyKey });
    return { row: actualizado.data, reintento: false };
  }
  const insertado = await supabase.from("miles_asociaciones").insert({ ...filaAsociacion(input), idempotency_key: input.idempotencyKey, payload_hash: payloadHash }).select("*").single();
  if (insertado.error) fallar(insertado.error);
  await evento("asociacion", String(insertado.data.id), MILES_ROL, "publicacion", {});
  return { row: insertado.data, reintento: false };
}

function filaAsociacion(input: AsociacionInput) {
  return {
    codigo_a: input.codigoA,
    codigo_b: input.codigoB,
    nombre_a: input.nombreA,
    nombre_b: input.nombreB,
    periodo_desde: input.periodoDesde,
    periodo_hasta: input.periodoHasta,
    n: input.n,
    n_a: input.nA,
    n_b: input.nB,
    n_ab: input.nAB,
    observacion: input.observacion,
    cambio: input.cambio,
    solidez: input.solidez,
    limitaciones: input.limitaciones,
    oportunidad: input.oportunidad,
    proximo_paso: input.proximoPaso,
    estado: input.estado,
    ejecucion_id: input.ejecucionId,
  };
}

export async function listarAsociaciones(limit = 40) {
  const { data, error } = await client().from("miles_asociaciones").select("*").order("actualizado_en", { ascending: false }).limit(limit);
  if (error) fallar(error);
  return data ?? [];
}

export async function guardarTareas(ejecucionId: string, tareas: TareaInput[]) {
  const supabase = client();
  const corrida = await supabase.from("miles_ejecuciones").select("id").eq("id", ejecucionId).maybeSingle();
  if (corrida.error) fallar(corrida.error);
  if (!corrida.data) throw new MilesError(404, "No está esa corrida");
  for (let index = 0; index < tareas.length; index += 1) {
    const tarea = tareas[index];
    const guardada = await supabase.from("miles_tareas").upsert(
      {
        ejecucion_id: ejecucionId,
        area: tarea.area,
        estado: tarea.estado,
        iniciada_en: tarea.iniciadaEn,
        terminada_en: tarea.terminadaEn,
        datos_revisados: tarea.datosRevisados,
        entregable: tarea.entregable,
        error: tarea.error,
        proximo_paso: tarea.proximoPaso,
        orden: index,
      },
      { onConflict: "ejecucion_id,area" },
    );
    if (guardada.error) fallar(guardada.error);
  }
  await evento("ejecucion", ejecucionId, MILES_ROL, "tareas", { areas: tareas.map((tarea) => tarea.area) });
  return listarTareas(ejecucionId);
}

export async function listarTareas(ejecucionId: string | null) {
  if (!ejecucionId) return [];
  const { data, error } = await client().from("miles_tareas").select("*").eq("ejecucion_id", ejecucionId).order("orden", { ascending: true });
  if (error) fallar(error);
  return data ?? [];
}
