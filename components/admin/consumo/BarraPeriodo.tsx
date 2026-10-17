import { COMPARACIONES, PRESETS_ANALITICA, PRESETS_LEGACY, describirPeriodo } from "@/lib/consumo-productos-ui";
import { formatDayKey } from "@/lib/local-day";
import { formatoInstante } from "@/lib/miles-presentacion";
import type { FrescuraConsumo } from "@/lib/pos-consumo";

export const controlPeriodo =
  "h-9 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";

export function BarraPeriodo({
  presetActual,
  comparacionActual,
  desde,
  hasta,
  texto,
  comparacionNoDisponible,
  onPreset,
  onComparacion,
  onDesde,
  onHasta,
}: {
  presetActual: string;
  comparacionActual: string;
  desde: string;
  hasta: string;
  texto: ReturnType<typeof describirPeriodo>;
  comparacionNoDisponible: boolean;
  onPreset: (preset: string) => void;
  onComparacion: (modo: string) => void;
  onDesde: (fecha: string) => void;
  onHasta: (fecha: string) => void;
}) {
  return (
    <section className="mt-4 rounded-lg border border-[#E6E8E6] bg-white px-3 py-3 shadow-sm" aria-label="Periodo y comparación">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-brand-muted">
          Periodo
          <select value={presetActual} onChange={(event) => onPreset(event.target.value)} className={`mt-1 block ${controlPeriodo}`}>
            {PRESETS_LEGACY[presetActual] ? <option value={presetActual}>{PRESETS_LEGACY[presetActual]}</option> : null}
            {PRESETS_ANALITICA.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-brand-muted">
          Comparar
          <select value={comparacionActual} onChange={(event) => onComparacion(event.target.value)} className={`mt-1 block min-w-[12rem] ${controlPeriodo}`}>
            {COMPARACIONES.map((modo) => (
              <option key={modo.id} value={modo.id}>
                {modo.label}
              </option>
            ))}
          </select>
        </label>
        {presetActual === "custom" ? (
          <>
            <label className="text-xs font-medium text-brand-muted">
              Desde
              <input type="date" value={desde} onChange={(event) => onDesde(event.target.value)} className={`mt-1 block ${controlPeriodo}`} />
            </label>
            <label className="text-xs font-medium text-brand-muted">
              Hasta
              <input type="date" value={hasta} onChange={(event) => onHasta(event.target.value)} className={`mt-1 block ${controlPeriodo}`} />
            </label>
          </>
        ) : null}
        <p className="pb-2 text-xs text-brand-muted md:ml-auto">
          {texto.rango} · {texto.dias} {texto.dias === 1 ? "día" : "días"}
          {texto.comparado ? ` · Comparado ${texto.comparado} · ${texto.diasComparados} días` : ""}
        </p>
      </div>
      {texto.aviso ? <p className="mt-2 text-xs text-[#92400E]">{texto.aviso}</p> : null}
      {comparacionNoDisponible ? (
        <p className="mt-2 text-xs text-[#92400E]">Comparación no disponible: falta algún día del periodo o del comparado. Un día sin datos no se toma como venta en cero.</p>
      ) : null}
    </section>
  );
}

export function LineaDatos({ frescura, hasta }: { frescura: FrescuraConsumo | null; hasta: string }) {
  return (
    <p className="mt-2 text-xs text-brand-muted">
      {frescura?.ultimaFecha ? (
        <>
          Datos hasta {formatDayKey(frescura.ultimaFecha)}
          {frescura.ultimaFecha < hasta ? `. El periodo seleccionado termina el ${formatDayKey(hasta)}` : ""}
          .{" "}
        </>
      ) : (
        "Todavía no hay sesiones de caja. "
      )}
      {frescura?.sincronizadoEn ? <>Sincronizado {formatoInstante(frescura.sincronizadoEn)}. </> : null}
      Moneda: RD$.
      {frescura && frescura.partesAbiertas > 0
        ? ` Hay ${frescura.partesAbiertas} ${frescura.partesAbiertas === 1 ? "sesión" : "sesiones"} en partes sin envío final.`
        : ""}
    </p>
  );
}
