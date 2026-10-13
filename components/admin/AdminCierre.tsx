"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatSignedPrice } from "@/lib/admin-dashboard-shared";
import { formatUsd } from "@/lib/admin-caja-shared";
import { formatPrice } from "@/lib/money";
import type { CierrePanel, ReporteLinea } from "@/lib/operacion-shared";
import { REPORTE_TIPOS } from "@/lib/operacion-shared";
import { brand } from "@/lib/theme";

function mesActual(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit" }).format(new Date());
}

function fecha(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function AdminCierre() {
  const [mes, setMes] = useState(mesActual);
  const [panel, setPanel] = useState<CierrePanel | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/admin/cierre?mes=${encodeURIComponent(mes)}`, { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as CierrePanel | { error?: string };
        if (!response.ok || !body || !("resumen" in body)) {
          throw new Error((body && "error" in body && body.error) || "No pudimos cargar el cierre");
        }
        if (!cancelled) {
          setPanel(body);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "No pudimos cargar el cierre");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mes]);

  const version = panel?.actual;
  const preliminar = panel?.preliminar !== false;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Finanzas</p>
          <h1 className="font-display mt-1 text-2xl font-bold">Cierre del mes</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">
            Hans, Fred, Troy y Robert publican aquí. Una versión aprobada no se edita: la corrección abre otra.
          </p>
        </div>
        <label className="text-sm font-semibold">
          Mes
          <input
            type="month"
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className="mt-1 block rounded-xl border px-3 py-2"
            style={{ borderColor: "#E5E7EB" }}
          />
        </label>
      </div>
      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-2xl bg-[#F3F4F6]" /> : null}
      {panel && !loading ? (
        <>
          <p
            className="mt-5 rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{ backgroundColor: preliminar ? brand.paleOrange : brand.paleGreen, color: preliminar ? "#9A3412" : "#3F6212" }}
          >
            {version
              ? preliminar
                ? `Versión ${version.numero} preliminar.${version.corrigeNumero ? ` Corrige la versión ${version.corrigeNumero}, que sigue aprobada.` : ""}`
                : `Versión ${version.numero} aprobada el ${fecha(version.aprobadaEn)}.`
              : "Todavía no hay versión. El mes se ve preliminar."}
            {version?.nota ? ` ${version.nota}` : ""}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResumenCard label="Ventas contra la meta" value={formatPrice(panel.resumen.ventas)} detail={panel.resumen.meta == null ? "Sin meta" : `Meta ${formatPrice(panel.resumen.meta)}`} />
            <ResumenCard label="Caja disponible" value={formatPrice(panel.resumen.cajaDisponibleDop)} detail={formatUsd(panel.resumen.cajaFuerteUsd)} />
            <ResumenCard label="Margen bruto" value={panel.resumen.margenBruto == null ? "Sin estado" : formatPrice(panel.resumen.margenBruto)} detail={anterior(panel.resumen.margenBrutoAnterior)} />
            <ResumenCard label="Ganancia neta" value={panel.resumen.gananciaNeta == null ? "Sin estado" : formatPrice(panel.resumen.gananciaNeta)} detail={anterior(panel.resumen.gananciaNetaAnterior)} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ResumenCard label="Por pagar vencido" value={formatPrice(panel.resumen.porPagar.vencido)} detail="Sin compras personales" />
            <ResumenCard label="Vence esta semana" value={formatPrice(panel.resumen.porPagar.estaSemana)} detail="Próximos 7 días" />
            <ResumenCard label="ITBIS a favor" value={formatPrice(panel.resumen.itbisAFavor)} detail="Facturas verificadas, socios incluidos" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(version?.entregas ?? [
              { bot: "hans" as const, estado: "pendiente" as const, resumen: null, entregadoEn: null },
              { bot: "fred" as const, estado: "pendiente" as const, resumen: null, entregadoEn: null },
              { bot: "robert" as const, estado: "pendiente" as const, resumen: null, entregadoEn: null },
            ]).map((entrega) => (
              <article key={entrega.bot} className="rounded-2xl bg-white px-4 py-3" style={{ border: "1px solid #E7EBE4" }}>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{entrega.bot}</p>
                <p className="mt-1 font-semibold capitalize">{entrega.estado}</p>
                <p className="mt-1 text-sm text-brand-muted">{entrega.resumen ?? fecha(entrega.entregadoEn)}</p>
              </article>
            ))}
            <article className="rounded-2xl bg-white px-4 py-3" style={{ border: "1px solid #E7EBE4" }}>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Troy</p>
              <p className="mt-1 font-semibold">{preliminar ? "Pendiente" : "Aprobado"}</p>
              <p className="mt-1 text-sm text-brand-muted">{version?.nota ?? "Aprueba por la API. La versión queda fija."}</p>
            </article>
          </div>
          {REPORTE_TIPOS.map((tipo) => (
            <Reporte
              key={tipo.id}
              titulo={tipo.label}
              lineas={(version?.lineas ?? []).filter((linea) => linea.tipo === tipo.id)}
              abierta={abierta}
              onToggle={(id) => setAbierta((current) => (current === id ? null : id))}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

function anterior(value: number | null): string {
  if (value == null) {
    return "Sin mes anterior aprobado";
  }
  return `Mes anterior ${formatSignedPrice(value)}`;
}

function ResumenCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl bg-white px-4 py-3" style={{ border: "1px solid #E7EBE4" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="font-display mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-brand-muted">{detail}</p>
    </article>
  );
}

function Reporte({
  titulo,
  lineas,
  abierta,
  onToggle,
}: {
  titulo: string;
  lineas: ReporteLinea[];
  abierta: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold">{titulo}</h2>
      {lineas.length === 0 ? <p className="mt-2 text-sm text-brand-muted">Robert todavía no publica este estado en la versión en curso.</p> : null}
      <div className="mt-2 space-y-2">
        {lineas.map((linea) => (
          <div key={linea.id} className="rounded-2xl bg-white" style={{ border: "1px solid #E7EBE4" }}>
            <button type="button" onClick={() => onToggle(linea.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="font-semibold">{linea.concepto}</span>
              <span className="tabular-nums">
                {formatPrice(linea.monto)}
                {linea.montoAnterior == null ? "" : ` · antes ${formatPrice(linea.montoAnterior)}`}
              </span>
            </button>
            {abierta === linea.id ? <Fuentes linea={linea} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Fuentes({ linea }: { linea: ReporteLinea }) {
  const vacio = linea.facturaIds.length + linea.asientoIds.length + linea.ledgerIds.length === 0;
  return (
    <div className="border-t border-[#E7EBE4] px-4 py-3 text-sm text-brand-muted">
      {vacio ? <p>Esta línea no trae facturas, asientos ni movimientos.</p> : null}
      {linea.facturaIds.map((id) => (
        <p key={id}>
          Factura <Link className="font-semibold underline" href={`/admin/facturas?factura=${id}`}>{id.slice(0, 8)}</Link>
        </p>
      ))}
      {linea.asientoIds.map((id) => (
        <p key={id}>Asiento {id.slice(0, 8)}</p>
      ))}
      {linea.ledgerIds.map((id) => (
        <p key={id}>Movimiento {id.slice(0, 8)}</p>
      ))}
    </div>
  );
}
