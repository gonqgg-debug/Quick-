import { isDayKey } from "@/lib/local-day";

export const HISTORY_STATES = ["despachada", "completada", "cancelada"] as const;
export type HistoryEstado = (typeof HISTORY_STATES)[number];

export const HISTORY_PAGE_SIZE = 50;

export type HistoryOrder = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  estado: HistoryEstado;
  direccion: string;
  totalEstimado: number;
  totalLabel: string;
  clienteNombre: string | null;
  clienteTelefono: string;
  itemCount: number;
  durationLabel: string;
};

export type HistoryFilters = {
  q: string;
  from: string | null;
  to: string | null;
  estados: HistoryEstado[];
  minTotal: number | null;
  maxTotal: number | null;
  page: number;
  pageSize: number;
};

export function isHistoryEstado(value: string): value is HistoryEstado {
  return (HISTORY_STATES as readonly string[]).includes(value);
}

export function sanitizeHistoryQuery(raw: string): string {
  return raw.replace(/[%*,()'"]/g, " ").trim().slice(0, 80);
}

function parseAmount(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function parseHistoryFilters(searchParams: URLSearchParams): HistoryFilters {
  const q = sanitizeHistoryQuery(searchParams.get("q") ?? "");
  const fromRaw = searchParams.get("from")?.trim() ?? "";
  const toRaw = searchParams.get("to")?.trim() ?? "";
  const from = isDayKey(fromRaw) ? fromRaw : null;
  const to = isDayKey(toRaw) ? toRaw : null;

  const estadoRaw = searchParams.get("estado")?.trim() ?? "";
  const parsedEstados = estadoRaw
    .split(",")
    .map((value) => value.trim())
    .filter(isHistoryEstado);
  const estados = parsedEstados.length > 0 ? parsedEstados : Array.from(HISTORY_STATES);

  const minTotal = parseAmount(searchParams.get("min"));
  const maxTotal = parseAmount(searchParams.get("max"));

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? HISTORY_PAGE_SIZE) || HISTORY_PAGE_SIZE;
  const pageSize = Math.min(100, Math.max(10, pageSizeRaw));

  return { q, from, to, estados, minTotal, maxTotal, page, pageSize };
}

export function historyQueryString(filters: Omit<HistoryFilters, "page" | "pageSize"> & { page?: number }): string {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.estados.length > 0 && filters.estados.length < HISTORY_STATES.length) {
    params.set("estado", filters.estados.join(","));
  }
  if (filters.minTotal != null) {
    params.set("min", String(filters.minTotal));
  }
  if (filters.maxTotal != null) {
    params.set("max", String(filters.maxTotal));
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  return params.toString();
}

export function formatHistoryDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
