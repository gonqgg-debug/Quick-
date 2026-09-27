import {
  EXPANSION_AGENT_ENDPOINTS,
  buildExpansionPipeline,
  expansionMetaCopy,
  parseClave,
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
const missing = parseClave(null);
assert(missing.ok && missing.clave === null, "sin clave también vale");
assert(!parseClave("con espacio").ok, "la clave no acepta espacios");
assert(!parseClave("a".repeat(81)).ok, "la clave tiene tope de 80");
assert(!parseClave(12).ok, "la clave tiene que ser texto");

const today = "2026-09-27";
assert(seguimientoVencido({ etapa: "visita", proximaFecha: "2026-09-26" }, today), "un paso atrasado está vencido");
assert(!seguimientoVencido({ etapa: "visita", proximaFecha: today }, today), "hoy todavía no está vencido");
assert(!seguimientoVencido({ etapa: "apertura", proximaFecha: "2026-01-01" }, today), "una apertura no se marca vencida");
assert(!seguimientoVencido({ etapa: "descartado", proximaFecha: "2026-01-01" }, today), "un descartado no se marca vencido");
assert(!seguimientoVencido({ etapa: "contacto", proximaFecha: null }, today), "sin fecha no hay vencimiento");

const pipeline = buildExpansionPipeline(
  [
    { etapa: "contacto", proximaFecha: "2026-01-01" },
    { etapa: "negociacion", proximaFecha: "2026-09-01" },
    { etapa: "apertura", proximaFecha: "2026-01-01" },
    { etapa: "descartado", proximaFecha: "2026-01-01" },
  ],
  [
    { id: "conversaciones", meta: 5 },
    { id: "negociacion", meta: 0 },
    { id: "aperturas", meta: 1 },
  ],
  today
);

assert(pipeline.activos === 2, "activos son los que no están en apertura ni descartados");
assert(pipeline.seguimientosVencidos === 2, "solo cuentan los abiertos con fecha pasada");
assert(pipeline.etapas.find((etapa) => etapa.id === "negociacion")?.sitios === 1, "cuenta por etapa");
const conversaciones = pipeline.metas.find((meta) => meta.id === "conversaciones");
const negociacion = pipeline.metas.find((meta) => meta.id === "negociacion");
const aperturas = pipeline.metas.find((meta) => meta.id === "aperturas");
assert(conversaciones?.actual === 2 && conversaciones.diferencia === -3, "la diferencia es actual menos meta");
assert(negociacion?.diferencia === null && negociacion.etiqueta === "En negociación", "meta 0 no tiene diferencia");
assert(aperturas?.actual === 1 && aperturas.diferencia === 0, "en la meta la diferencia es cero");
assert(expansionMetaCopy("conversaciones").etiqueta === "Conversaciones activas", "la etiqueta no es el id");
assert(EXPANSION_AGENT_ENDPOINTS.length === 13, "el directorio del agente lista las rutas de expansión");

console.log("expansion pipeline ok");
