"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DEFINICIONES, formatNumero, formatRd } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";
import { MapaCalor } from "@/components/admin/consumo/charts";
import { Definicion, Metrica } from "@/components/admin/consumo/ui";

export function ConsumoHorariosVista({
  celdas,
  turnos,
  categorias,
  categoria,
  metrica,
}: {
  celdas: Array<{ dow: number; hora: number; venta: number; ordenes: number; unidades: number }>;
  turnos: Array<{ turno: "am" | "pm"; venta: number; ordenes: number; ticket: number | null; unidadesPorTicket: number | null }>;
  categorias: string[];
  categoria: string;
  metrica: "venta" | "ordenes" | "unidades";
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
            ["venta", "Venta"],
            ["ordenes", "Órdenes"],
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
        <label className="ml-auto text-xs font-medium text-brand-muted">
          Categoría
          <select
            value={categoria}
            onChange={(event) => ir({ categoria: event.target.value || null })}
            className="ml-2 rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm text-brand-ink"
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
        <p className="mt-1 text-xs text-brand-muted">Una venta después de medianoche sigue en el día en que se abrió la caja.</p>
        {categoria ? <p className="mt-1 text-xs text-brand-muted">Con categoría, el monto es el de las líneas.</p> : null}
        <div className="mt-4">
          <MapaCalor celdas={celdas} metrica={metrica} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {turnos.map((turno) => (
          <div key={turno.turno} className="grid gap-3 sm:grid-cols-3">
            <Metrica etiqueta={turno.turno === "am" ? "Turno AM" : "Turno PM"} valor={formatRd(turno.venta)} definicion="Antes de las 2:00 p.m. es AM. Desde las 2:00 p.m. es PM, según la apertura de la sesión." detalle={`${formatNumero(turno.ordenes)} órdenes`} />
            <Metrica etiqueta="Ticket" valor={formatRd(turno.ticket)} definicion={DEFINICIONES.ticket} />
            <Metrica etiqueta="Uds / ticket" valor={formatNumero(turno.unidadesPorTicket, 2)} definicion={DEFINICIONES.unidadesTicket} />
          </div>
        ))}
      </section>
    </div>
  );
}
