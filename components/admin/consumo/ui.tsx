"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatNumero, formatPct, formatRd } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";

export function Dinero({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatRd(value)}</span>;
}

export function Delta({
  actual,
  anterior,
  estado = "ok",
  formato = "rd",
}: {
  actual: number | null;
  anterior: number | null;
  estado?: "ok" | "off" | "no_disponible" | "sin_base";
  formato?: "rd" | "num";
}) {
  if (estado === "off") {
    return <span className="text-xs text-brand-muted">Sin comparación</span>;
  }
  if (estado === "no_disponible" || actual == null || anterior == null) {
    return <span className="text-xs text-brand-muted">Comparación no disponible</span>;
  }
  if (estado === "sin_base" || anterior === 0) {
    const texto = formato === "num" ? formatNumero(actual, 2) : formatRd(actual);
    return <span className="text-xs text-brand-muted">Sin base anterior · ahora {texto}</span>;
  }
  const pct = (actual - anterior) / Math.abs(anterior);
  const color = Math.abs(pct) < 0.005 ? brand.muted : pct > 0 ? "#166534" : brand.error;
  return (
    <span className="text-xs font-semibold tabular-nums" style={{ color }}>
      {formatPct(pct)} vs periodo comparado
    </span>
  );
}

export function Definicion({ texto }: { texto: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-expanded={abierta}
        aria-label="Definición"
        onClick={() => setAbierta((value) => !value)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#E5E7EB] text-[10px] font-bold text-brand-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
      >
        i
      </button>
      {abierta ? (
        <span className="absolute left-0 top-6 z-20 w-64 rounded-lg border border-[#E5E7EB] bg-white p-3 text-left text-xs font-normal normal-case leading-5 tracking-normal text-brand-ink shadow-sm">
          {texto}
        </span>
      ) : null}
    </span>
  );
}

export function Pildora({ tono, children }: { tono: "gris" | "naranja" | "verde" | "rojo"; children: React.ReactNode }) {
  const styles = {
    gris: { backgroundColor: "#F3F4F6", color: "#374151" },
    naranja: { backgroundColor: "#FEF3C7", color: "#92400E" },
    verde: { backgroundColor: "#ECFDF3", color: "#166534" },
    rojo: { backgroundColor: "#FEE2E2", color: brand.error },
  } as const;
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={styles[tono]}>
      {children}
    </span>
  );
}

export function Metrica({
  etiqueta,
  valor,
  definicion,
  detalle,
  delta,
}: {
  etiqueta: string;
  valor: string;
  definicion: string;
  detalle?: string;
  delta?: React.ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <p className="flex items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
        {etiqueta}
        <Definicion texto={definicion} />
      </p>
      <p className="mt-2 break-words text-xl font-semibold tabular-nums leading-tight text-[#111827] sm:text-2xl">{valor}</p>
      {detalle ? <p className="mt-1 text-xs text-brand-muted">{detalle}</p> : null}
      {delta ? <div className="mt-2">{delta}</div> : null}
    </article>
  );
}

export function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="rounded-lg px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
      <p className="font-display text-xl font-bold">{titulo}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">{detalle}</p>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
      <p>{message}</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Reintentar
      </button>
    </div>
  );
}
