export const ETIQUETA_TIPO_PROMO: Record<string, string> = {
  combo: "Combo",
  acompanamiento: "Acompañamiento",
  compra_minima: "Compra mínima",
  horario: "Horario",
  salida_inventario: "Salida de inventario",
};

export const ETIQUETA_ESTADO_PROPUESTA: Record<string, string> = {
  borrador: "En evaluación",
  por_revisar: "En evaluación",
  requiere_ampliacion: "Bloqueada",
  bloqueada: "Bloqueada",
  lista_para_probar: "Lista para decisión",
  aprobada: "Aprobada para implementar",
  implementada: "Implementada, en prueba",
  evaluada: "Evaluada",
  descartada: "Descartada",
  archivada: "Archivada",
};

export const ETIQUETA_FUNCION_PRODUCTO: Record<string, string> = {
  principal: "Principal",
  complemento: "Complemento",
  beneficio: "Beneficio",
};

export const ETIQUETA_ESTADO_PRUEBA: Record<string, string> = {
  propuesta: "Propuesta",
  aprobada: "Aprobada",
  en_curso: "En curso",
  pendiente_evaluacion: "Pendiente de evaluar",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export function dinero(value: unknown): string {
  if (value == null || value === "") return "No disponible";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "No disponible";
  const negative = amount < 0;
  const [whole, frac] = Math.abs(amount).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}RD$${grouped}.${frac}`;
}

export function cantidadTexto(value: unknown): string {
  if (value == null || value === "") return "No disponible";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "No disponible";
  return String(Math.round(amount * 1000) / 1000);
}

export function metricaObservada(metricas: unknown): { nombre: string; valor: string } | null {
  if (!metricas || typeof metricas !== "object" || Array.isArray(metricas)) return null;
  for (const [nombre, valor] of Object.entries(metricas as Record<string, unknown>)) {
    if (typeof valor === "number" && Number.isFinite(valor)) return { nombre, valor: String(valor) };
    if (typeof valor === "string" && valor.trim()) return { nombre, valor: valor.trim() };
  }
  return null;
}

export function ordenAtencion(row: { estado?: unknown; pruebas?: Array<{ estado?: unknown }> }): number {
  const pruebas = row.pruebas ?? [];
  if (pruebas.some((prueba) => prueba.estado === "pendiente_evaluacion")) return 0;
  if (pruebas.some((prueba) => prueba.estado === "en_curso")) return 1;
  if (row.estado === "por_revisar") return 2;
  if (row.estado === "requiere_ampliacion") return 3;
  if (row.estado === "lista_para_probar") return 4;
  if (row.estado === "borrador") return 5;
  return 6;
}

type FilaIndicador = {
  estado?: unknown;
  pruebas?: Array<{ estado?: unknown }>;
  evaluaciones?: unknown[];
};

export function indicadoresPromo(rows: FilaIndicador[]) {
  return {
    revisar: rows.filter((row) => row.estado === "por_revisar").length,
    prueba: rows.filter((row) => (row.pruebas ?? []).some((prueba) => prueba.estado === "en_curso")).length,
    evaluar: rows.filter((row) => (row.pruebas ?? []).some((prueba) => prueba.estado === "pendiente_evaluacion")).length,
    evaluadas: rows.filter((row) => (row.evaluaciones ?? []).length > 0).length,
  };
}

export function probabilidadCompleta(value: unknown): {
  valor: number;
  objetivo: string;
  horizonte: string;
  modelo: string;
  version: string;
  datos: string;
  supuestos: string;
  validacion: string;
  evaluadaEn: string;
  limitaciones: string;
  intervalo: { inferior: number; superior: number; representa: string } | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const textos = ["objetivo", "horizonte", "modelo", "version", "datos", "supuestos", "validacion", "evaluadaEn", "limitaciones"] as const;
  if (textos.some((campo) => typeof raw[campo] !== "string" || String(raw[campo]).trim() === "")) return null;
  if (typeof raw.valor !== "number" || raw.valor < 0 || raw.valor > 1) return null;
  let intervalo: { inferior: number; superior: number; representa: string } | null = null;
  if (raw.intervalo && typeof raw.intervalo === "object" && !Array.isArray(raw.intervalo)) {
    const rango = raw.intervalo as Record<string, unknown>;
    if (typeof rango.inferior === "number" && typeof rango.superior === "number" && typeof rango.representa === "string" && rango.representa.trim()) {
      intervalo = { inferior: rango.inferior, superior: rango.superior, representa: rango.representa };
    }
  }
  return {
    valor: raw.valor,
    objetivo: String(raw.objetivo),
    horizonte: String(raw.horizonte),
    modelo: String(raw.modelo),
    version: String(raw.version),
    datos: String(raw.datos),
    supuestos: String(raw.supuestos),
    validacion: String(raw.validacion),
    evaluadaEn: String(raw.evaluadaEn),
    limitaciones: String(raw.limitaciones),
    intervalo,
  };
}
