import {
  EXPANSION_AGENT_ENDPOINTS,
  buildExpansionPipeline,
  expansionMetaCopy,
  parseClave,
  parseCoord,
  parseEtapa,
  parseFuente,
  seguimientoVencido,
} from "../lib/expansion-shared";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const spaced = parseClave(" broker.juan ");
assert(spaced.ok && spaced.clave === "broker.juan", "la clave se recorta");
const empty = parseClave("");
assert(empty.ok && empty.clave === null, "la clave vacía es opcional");
assert(!parseClave("con espacio").ok, "la clave no acepta espacios");

assert(parseEtapa("Presentación enviada") === "presentacion_enviada", "acepta la etiqueta de la etapa");
assert(parseEtapa("Escalamiento / negociación") === "negociacion", "acepta el nombre largo de negociación");
assert(parseFuente("Google Maps") === "maps", "acepta Google Maps como fuente");
const lat = parseCoord("18.6200004", "lat");
const lng = parseCoord(-68.42, "lng");
assert(lat.ok && lat.value === 18.62, "la latitud se redondea");
assert(lng.ok && lng.value === -68.42, "la longitud numérica vale");
assert(!parseCoord(120, "lat").ok, "la latitud fuera de rango se rechaza");
const emptyLng = parseCoord("", "lng");
assert(emptyLng.ok && emptyLng.value === null, "sin coordenada es null");

const today = "2026-09-27";
assert(seguimientoVencido({ etapa: "contactado", proximaFecha: "2026-09-26" }, today), "un paso atrasado está vencido");
assert(!seguimientoVencido({ etapa: "contactado", proximaFecha: today }, today), "hoy todavía no está vencido");
assert(!seguimientoVencido({ etapa: "pausa", proximaFecha: "2026-01-01" }, today), "una pausa no se marca vencida");
assert(!seguimientoVencido({ etapa: "descartado", proximaFecha: "2026-01-01" }, today), "un descartado no se marca vencido");

const pipeline = buildExpansionPipeline(
  [
    { etapa: "identificado", proximaFecha: "2026-01-01" },
    { etapa: "conversacion", proximaFecha: "2026-09-01" },
    { etapa: "oportunidad", proximaFecha: "2026-01-01" },
    { etapa: "negociacion", proximaFecha: "2026-09-01" },
    { etapa: "pausa", proximaFecha: "2026-01-01" },
    { etapa: "descartado", proximaFecha: "2026-01-01" },
  ],
  [
    { id: "conversaciones", meta: 5 },
    { id: "negociacion", meta: 0 },
    { id: "oportunidades", meta: 1 },
  ],
  today
);

assert(pipeline.activos === 4, "activos excluyen pausa y descartado");
assert(pipeline.seguimientosVencidos === 4, "solo cuentan los abiertos con fecha pasada");
assert(pipeline.etapas.find((etapa) => etapa.id === "oportunidad")?.sitios === 1, "cuenta por etapa");
const conversaciones = pipeline.metas.find((meta) => meta.id === "conversaciones");
const negociacion = pipeline.metas.find((meta) => meta.id === "negociacion");
const oportunidades = pipeline.metas.find((meta) => meta.id === "oportunidades");
assert(conversaciones?.actual === 1 && conversaciones.diferencia === -4, "la diferencia es actual menos meta");
assert(negociacion?.diferencia === null && negociacion.etiqueta === "En negociación", "meta 0 no tiene diferencia");
assert(oportunidades?.actual === 1 && oportunidades.diferencia === 0, "en la meta la diferencia es cero");
assert(expansionMetaCopy("conversaciones").etiqueta === "Conversaciones activas", "la etiqueta no es el id");
assert(EXPANSION_AGENT_ENDPOINTS.length === 13, "el directorio del agente lista las rutas de expansión");

console.log("expansion pipeline ok");
