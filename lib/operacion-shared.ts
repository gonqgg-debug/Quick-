import type { AgentRol } from "@/lib/agent-auth";
import type { FacturaEstado } from "@/lib/facturas-shared";
import { isMonthKey } from "@/lib/admin-parametros-shared";

export type Actor = AgentRol | "admin";

export const OPERACION_BOTS = ["rodrigo", "phillip", "boris", "fred", "hans", "matt", "troy", "robert"] as const;
export type OperacionBot = (typeof OPERACION_BOTS)[number];

export const CIERRE_BOTS = ["hans", "fred", "robert"] as const;
export type CierreBot = (typeof CIERRE_BOTS)[number];

export const VERIFICACION_RESULTADOS = [
  { id: "cuadra", label: "Cuadra" },
  { id: "falta", label: "Falta" },
  { id: "diferencia", label: "Diferencia" },
] as const;

export const CONCILIACION_RESULTADOS = [
  { id: "pagada", label: "Pagada" },
  { id: "vencida_sin_pagar", label: "Vencida sin pagar" },
  { id: "pagada_sin_movimiento", label: "Pagada sin movimiento" },
  { id: "falta_factura", label: "Falta factura" },
] as const;

export const CONCILIACION_MEDIOS = [
  { id: "banco", label: "Banco" },
  { id: "caja", label: "Caja" },
  { id: "cardnet", label: "CardNET" },
] as const;

export const REPORTE_TIPOS = [
  { id: "resultados", label: "Estado de resultados" },
  { id: "balance", label: "Balance general" },
  { id: "flujo", label: "Flujo de caja" },
] as const;

export type VerificacionResultado = (typeof VERIFICACION_RESULTADOS)[number]["id"];
export type ConciliacionResultado = (typeof CONCILIACION_RESULTADOS)[number]["id"];
export type ConciliacionMedio = (typeof CONCILIACION_MEDIOS)[number]["id"];
export type ReporteTipo = (typeof REPORTE_TIPOS)[number]["id"];
export type DecisionEstado = "pendiente" | "si" | "no";
export type ExcepcionEstado = "abierta" | "resuelta";
export type CierreEstado = "preliminar" | "aprobada";

const ETAPA_ACTORES: Record<FacturaEstado, readonly Actor[]> = {
  falta_factura: ["rodrigo", "fred", "admin"],
  recibida: ["lectura", "rodrigo", "phillip", "boris", "fred", "hans", "matt", "troy", "robert", "admin"],
  registrada: ["phillip", "admin"],
  verificada: ["boris", "admin"],
  conciliada: ["fred", "admin"],
};

export function puedeCambiarEtapa(actor: Actor, estado: FacturaEstado): boolean {
  return ETAPA_ACTORES[estado].includes(actor);
}

export type RecepcionConteo = {
  esCompraPersonal: boolean;
  /** Líneas de productos de la factura. */
  lineas: number;
  /** Líneas que Rodrigo todavía no marcó completa, faltante o regalo. */
  lineasSinRecepcion: number;
};

export function validarCambioEstado(input: RecepcionConteo & { actor: Actor; estado: FacturaEstado }): void {
  if (!puedeCambiarEtapa(input.actor, input.estado)) {
    throw new Error(mensajePermisoEtapa(input.estado));
  }
  if (input.estado === "registrada" && !puedeRegistrar(input)) {
    throw new Error(motivoNoRegistrable(input) ?? "Phillip todavía no puede dejarla registrada");
  }
}

export function puedeRegistrar(input: RecepcionConteo): boolean {
  return motivoNoRegistrable(input) === null;
}

export function motivoNoRegistrable(input: RecepcionConteo): string | null {
  if (input.esCompraPersonal) {
    return null;
  }
  if (input.lineas === 0) {
    return "Phillip no puede dejarla registrada sin productos";
  }
  if (input.lineasSinRecepcion > 0) {
    return input.lineasSinRecepcion === 1
      ? "Phillip no puede dejarla registrada: Rodrigo todavía no confirma la recepción de 1 línea"
      : `Phillip no puede dejarla registrada: Rodrigo todavía no confirma la recepción de ${input.lineasSinRecepcion} líneas`;
  }
  return null;
}

function mensajePermisoEtapa(estado: FacturaEstado): string {
  if (estado === "verificada") {
    return "Solo Boris puede marcar la factura verificada";
  }
  if (estado === "conciliada") {
    return "Solo Fred puede marcar la factura conciliada";
  }
  if (estado === "registrada") {
    return "Solo Phillip puede marcar la factura registrada";
  }
  if (estado === "falta_factura") {
    return "Solo Rodrigo o Fred pueden marcar que falta la factura";
  }
  return "Este acceso no puede cambiar esa etapa";
}

export function esOperacionBot(value: string): value is OperacionBot {
  return (OPERACION_BOTS as readonly string[]).includes(value);
}

export function esCierreBot(value: string): value is CierreBot {
  return (CIERRE_BOTS as readonly string[]).includes(value);
}

export type DecisionOrden = {
  monto: number | null;
  venceEn: string | null;
  creadaEn: string;
};

export function compararDecisiones(a: DecisionOrden, b: DecisionOrden): number {
  const montoA = a.monto ?? Number.NEGATIVE_INFINITY;
  const montoB = b.monto ?? Number.NEGATIVE_INFINITY;
  if (montoA !== montoB) {
    return montoB - montoA;
  }
  if (a.venceEn && b.venceEn && a.venceEn !== b.venceEn) {
    return a.venceEn < b.venceEn ? -1 : 1;
  }
  if (a.venceEn && !b.venceEn) {
    return -1;
  }
  if (!a.venceEn && b.venceEn) {
    return 1;
  }
  return a.creadaEn < b.creadaEn ? -1 : a.creadaEn > b.creadaEn ? 1 : 0;
}

export function decisionVencida(venceEn: string | null, today: string, estado: DecisionEstado): boolean {
  return estado === "pendiente" && Boolean(venceEn) && (venceEn as string) < today;
}

export function assertVersionEditable(estado: CierreEstado): void {
  if (estado !== "preliminar") {
    throw new Error("Troy ya aprobó esa versión. Hay que abrir una versión nueva");
  }
}

export function mesAnterior(mes: string): string | null {
  if (!isMonthKey(mes)) {
    return null;
  }
  const year = Number(mes.slice(0, 4));
  const month = Number(mes.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 2, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

export function monthBounds(mes: string): { desde: string; hasta: string } {
  const year = Number(mes.slice(0, 4));
  const month = Number(mes.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(last).padStart(2, "0")}` };
}

export function conceptoEsMargen(concepto: string): boolean {
  return concepto.toLowerCase().includes("margen bruto");
}

export function conceptoEsGanancia(concepto: string): boolean {
  const text = concepto.toLowerCase();
  return text.includes("ganancia neta") || text.includes("utilidad neta");
}

export type Decision = {
  id: string;
  facturaId: string | null;
  facturaReferencia: string | null;
  autor: OperacionBot;
  pregunta: string;
  monto: number | null;
  venceEn: string | null;
  siNoContesta: string;
  estado: DecisionEstado;
  vencida: boolean;
  resueltaEn: string | null;
  creadaEn: string;
};

export type Excepcion = {
  id: string;
  facturaId: string | null;
  facturaReferencia: string | null;
  autor: OperacionBot;
  dueno: OperacionBot;
  queFalta: string;
  estado: ExcepcionEstado;
  resolucion: string | null;
  abiertaEn: string;
  resueltaEn: string | null;
};

export type CierreEntrega = {
  bot: CierreBot;
  estado: "pendiente" | "entregado";
  resumen: string | null;
  entregadoEn: string | null;
};

export type Asiento = {
  id: string;
  numero: number;
  fecha: string | null;
  cuenta: string;
  debe: number;
  haber: number;
  facturaId: string | null;
  ledgerId: string | null;
  nota: string | null;
};

export type ReporteLinea = {
  id: string;
  tipo: ReporteTipo;
  orden: number;
  concepto: string;
  monto: number;
  montoAnterior: number | null;
  facturaIds: string[];
  asientoIds: string[];
  ledgerIds: string[];
};

export type CierreVersion = {
  id: string;
  mes: string;
  numero: number;
  estado: CierreEstado;
  nota: string | null;
  corrigeNumero: number | null;
  aprobadaEn: string | null;
  creadaEn: string;
  entregas: CierreEntrega[];
  asientos: Asiento[];
  lineas: ReporteLinea[];
};

export type CierreResumenNumeros = {
  ventas: number;
  meta: number | null;
  diferenciaMeta: number | null;
  cajaDisponibleDop: number;
  cajaFuerteUsd: number;
  margenBruto: number | null;
  gananciaNeta: number | null;
  margenBrutoAnterior: number | null;
  gananciaNetaAnterior: number | null;
  itbisAFavor: number;
  porPagar: { vencido: number; estaSemana: number; despues: number };
};

export type CierrePanel = {
  mes: string;
  preliminar: boolean;
  actual: CierreVersion | null;
  aprobada: CierreVersion | null;
  versiones: Array<{ numero: number; estado: CierreEstado; aprobadaEn: string | null }>;
  resumen: CierreResumenNumeros;
};

export const OPERACION_AGENT_ENDPOINTS = [
  {
    method: "POST",
    path: "/api/agent/facturas/{id}/confirmacion",
    describe: "Rodrigo guarda la respuesta de Ramón: texto, confirmadoPor y fecha. Queda como evidencia; lo que habilita registrada es la recepción por línea.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id}/recepcion",
    describe:
      "Rodrigo confirma qué llegó. lineas[{ numeroLinea, recepcion, cantidadRecibida }] con recepcion completa, faltante (cantidadRecibida obligatoria, 0 si no llegó nada) o regalo. Si llegó todo, manda todas: \"completa\". Phillip solo puede pasar a registrada cuando ninguna línea queda sin confirmar, salvo compra personal.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id}/marca",
    describe: "Rodrigo marca esCompraPersonal y el socio. Cuenta para el ITBIS y no entra en cuentas por pagar ni como mercancía.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id}/verificacion",
    describe: "Boris publica resultado cuadra, falta o diferencia, con RNC, NCF y los montos de factura, sistema, caja y DGII. Solo él deja la etapa en verificada.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id}/conciliacion",
    describe: "Fred publica pagada, vencida_sin_pagar, pagada_sin_movimiento o falta_factura, con medio banco, caja o cardnet. Solo él deja la etapa en conciliada.",
  },
  {
    method: "GET",
    path: "/api/agent/decisiones",
    describe: "Bandeja ordenada por monto y por fecha de vencimiento. Cada pregunta trae qué pasa si no se contesta.",
  },
  {
    method: "POST",
    path: "/api/agent/decisiones",
    describe: "Cualquier bot abre una decisión de sí o no. No puede contestarla.",
  },
  {
    method: "GET",
    path: "/api/agent/excepciones",
    describe: "Casos abiertos con dueño, desde cuándo y qué falta.",
  },
  {
    method: "POST",
    path: "/api/agent/excepciones",
    describe: "Boris, Hans, Fred o Matt abren un caso. El dueño por defecto es Matt.",
  },
  {
    method: "PATCH",
    path: "/api/agent/excepciones/{id}",
    describe: "Matt publica la resolución y cierra el caso.",
  },
  {
    method: "GET",
    path: "/api/agent/cierres?mes=YYYY-MM",
    describe: "Panel del mes: versión preliminar o aprobada, entregas de Hans, Fred y Robert, asientos y los tres estados.",
  },
  {
    method: "POST",
    path: "/api/agent/cierres/{mes}/versiones",
    describe: "Abre la siguiente versión si Troy ya aprobó la anterior. La aprobada no se edita.",
  },
  {
    method: "POST",
    path: "/api/agent/cierres/{mes}/asientos",
    describe: "Hans publica asientos con cuenta, debe, haber y la factura o el movimiento de cada línea.",
  },
  {
    method: "POST",
    path: "/api/agent/cierres/{mes}/entregas",
    describe: "Hans, Fred o Robert marcan su entrega del mes. El bot del token tiene que coincidir.",
  },
  {
    method: "POST",
    path: "/api/agent/cierres/{mes}/reportes",
    describe: "Robert publica resultados, balance o flujo, línea por línea, con los ids que forman cada cifra. En resultados, el concepto Margen bruto y Ganancia neta alimentan el resumen.",
  },
  {
    method: "POST",
    path: "/api/agent/cierres/{mes}/aprobar",
    describe: "Troy aprueba la versión abierta o deja escrito lo que falta. aprobar true fija esa versión.",
  },
] as const;
