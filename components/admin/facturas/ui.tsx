import type { ReactNode } from "react";
import {
  FACTURA_ESTADOS,
  type FacturaEstado,
  type FacturaResultado,
  type FacturaResumen,
} from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";

export type PillTone = { backgroundColor: string; color: string };

export const TONO = {
  verde: { backgroundColor: brand.paleGreen, color: "#3F6212" },
  rojo: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  naranja: { backgroundColor: brand.paleOrange, color: "#9A3412" },
  azul: { backgroundColor: brand.paleBlue, color: brand.blue },
  navy: { backgroundColor: "#E8EEF8", color: brand.navy },
  gris: { backgroundColor: "#F3F4F6", color: brand.muted },
} satisfies Record<string, PillTone>;

/** Main path of a ficha. falta_factura sits outside it, before the receipt arrives. */
export const ETAPAS_CAMINO: Array<{ id: Exclude<FacturaEstado, "falta_factura">; label: string; quien: string }> = [
  { id: "recibida", label: "Recibida", quien: "Rodrigo" },
  { id: "registrada", label: "Registrada", quien: "Phillip" },
  { id: "verificada", label: "Verificada", quien: "Boris" },
  { id: "conciliada", label: "Conciliada", quien: "Fred" },
];

export function pasoDeEtapa(estado: FacturaEstado): number {
  return ETAPAS_CAMINO.findIndex((item) => item.id === estado);
}

export function fechaCorta(value: string | null): string {
  if (!value) {
    return "—";
  }
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

export function fechaHora(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function estadoTono(estado: FacturaEstado): PillTone {
  if (estado === "conciliada" || estado === "verificada") {
    return TONO.verde;
  }
  if (estado === "falta_factura") {
    return TONO.naranja;
  }
  if (estado === "registrada") {
    return TONO.navy;
  }
  return TONO.azul;
}

export function resultadoTono(resultado: FacturaResultado): PillTone {
  if (resultado === "correcto") {
    return TONO.verde;
  }
  if (resultado === "diferencia") {
    return TONO.rojo;
  }
  if (resultado === "no_aplica") {
    return TONO.gris;
  }
  return TONO.naranja;
}

export function estadoCorto(estado: FacturaEstado): string {
  return FACTURA_ESTADOS.find((item) => item.id === estado)?.corto ?? estado;
}

export function fotoLabel(factura: Pick<FacturaResumen, "tieneFoto" | "numeroDocumentos">): string {
  if (!factura.tieneFoto) {
    return "Sin foto";
  }
  return factura.numeroDocumentos === 1 ? "1 foto" : `${factura.numeroDocumentos} páginas`;
}

export function Pill({ label, tone, title }: { label: string; tone: PillTone; title?: string }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={tone} title={title}>
      {label}
    </span>
  );
}

export function Aviso({ children, tone = TONO.rojo }: { children: ReactNode; tone?: PillTone }) {
  return (
    <p className="rounded-2xl px-4 py-3 text-sm" style={tone}>
      {children}
    </p>
  );
}

export function Seccion({
  id,
  titulo,
  extra,
  children,
}: {
  id: string;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-[#E7EBE4] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{titulo}</h2>
        {extra}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Dato({ label, value, strong = false }: { label: string; value: string | null; strong?: boolean }) {
  const shown = value && value !== "—" ? value : "—";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className={`mt-0.5 break-words tabular-nums ${strong ? "text-base font-bold" : "font-semibold"}`}>{shown}</dd>
    </div>
  );
}

export function BotonPrincipal({
  children,
  onClick,
  disabled,
  color = brand.green,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-50"
      style={{ minHeight: 40, backgroundColor: color }}
    >
      {children}
    </button>
  );
}

export function BotonSecundario({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-[#E5E7EB] bg-white px-4 text-sm font-semibold disabled:opacity-50"
      style={{ minHeight: 40 }}
    >
      {children}
    </button>
  );
}
