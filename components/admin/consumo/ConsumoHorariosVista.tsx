"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DEFINICIONES_CONSUMO } from "@/lib/consumo-metricas";
import { DEFINICIONES, formatNumero, formatRd } from "@/lib/pos-domain";
import type { CeldaHorario } from "@/lib/pos-consumo";
import { brand } from "@/lib/theme";
import { MapaCalor } from "@/components/admin/consumo/charts";
import { Definicion } from "@/components/admin/consumo/ui";

export function ConsumoHorariosVista({
  celdas,
  turnos,
  categorias,
  categoria,
  metrica,
  reloj,
  desde,
  hasta,
}: {
  celdas: CeldaHorario[];
  turnos: Array<{ turno: "am" | "pm"; venta: number; ordenes: number; ticket: number | null; unidadesPorTicket: number | null }>;
  categorias: string[];
  categoria: string;
  metrica: "venta" | "ordenes" | "unidades" | "promedio" | "ticket";
  reloj: "real" | "caja";
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function ir(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.push(`/admin/consumo/horarios?${next.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["venta", "Total"],
            ["promedio", "Promedio"],
            ["ticket", "Ticket"],
            ["ordenes", "Tickets"],
            ["unidades", "Unidades"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => ir({ metrica: id })}
            className="rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            style={{ backgroundColor: metrica === id ? "#111827" : "#F3F4F6", color: metrica === id ? "#FFFFFF" : brand.ink }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => ir({ reloj: reloj === "real" ? "caja" : "real" })}
          className="rounded-full px-3 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: "#F3F4F6", color: brand.ink }}
        >
          {reloj === "real" ? "Hora real" : "Día de caja"}
        </button>
        <label className="text-xs font-medium text-brand-muted">
          Categoría
          <select
            value={categoria}
            onChange={(event) => ir({ categoria: event.target.value || null })}
            className="ml-2 max-w-[220px] rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm text-brand-ink"
          >
            <option value="">Todas</option>
            {categorias.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h2 className="flex items-center text-sm font-semibold text-[#111827]">
          Hora por día de la semana
          <Definicion texto={DEFINICIONES.hora} />
        </h2>
        <p className="mt-1 text-xs text-brand-muted">{reloj === "real" ? DEFINICIONES_CONSUMO.horaReal : DEFINICIONES_CONSUMO.horaCaja}</p>
        {categoria ? <p className="mt-1 text-xs text-brand-muted">Con categoría, el monto es el de las líneas.</p> : null}
        <div className="mt-4">
          <MapaCalor celdas={celdas} metrica={metrica} desde={desde} hasta={hasta} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {turnos.map((turno) => (
          <article key={turno.turno} className="min-w-0 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[#111827]">{turno.turno === "am" ? "Turno AM" : "Turno PM"}</h3>
            <p className="mt-2 break-words text-xl font-semibold tabular-nums text-[#111827]">{formatRd(turno.venta)}</p>
            <p className="mt-1 text-sm text-brand-muted">
              {formatNumero(turno.ordenes)} tickets · ticket {formatRd(turno.ticket)} · {formatNumero(turno.unidadesPorTicket, 2)} uds/ticket
            </p>
            <p className="mt-2 text-xs text-brand-muted">AM es una caja abierta antes de las 2:00 p.m. PM, desde esa hora. El importe es la venta del turno, con ITBIS.</p>
          </article>
        ))}
      </section>
    </div>
  );
}
