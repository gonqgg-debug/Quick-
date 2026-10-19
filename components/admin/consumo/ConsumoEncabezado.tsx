"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDayKey } from "@/lib/local-day";
import type { FrescuraConsumo } from "@/lib/pos-consumo";
import { resolverPeriodo } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";

const TABS = [
  { href: "/admin/consumo", label: "Resumen" },
  { href: "/admin/consumo/productos", label: "Productos" },
  { href: "/admin/consumo/horarios", label: "Horarios" },
  { href: "/admin/consumo/canasta", label: "Canasta" },
  { href: "/admin/consumo/miles", label: "Miles" },
  { href: "/admin/consumo/calidad", label: "Calidad" },
];

function activo(pathname: string, href: string): boolean {
  if (href === "/admin/consumo") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function conQuery(pathname: string, params: URLSearchParams, patch: Record<string, string | null> = {}): string {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  next.delete("cursor");
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function ConsumoEncabezado({ frescura }: { frescura: FrescuraConsumo | null }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const esListaProductos = pathname === "/admin/consumo/productos";
  const esResumen = pathname === "/admin/consumo";
  const esDetalleProducto = pathname.startsWith("/admin/consumo/productos/");
  const esHorarios = pathname.startsWith("/admin/consumo/horarios");
  const esMiles = pathname.startsWith("/admin/consumo/miles");
  const muestraPeriodo = pathname === "/admin/consumo" || esDetalleProducto || pathname.startsWith("/admin/consumo/horarios");
  const preset = params.get("preset") ?? (params.get("desde") || params.get("hasta") ? "custom" : "7d");
  const comparacion = params.get("comparar") === "0" ? "off" : (params.get("comparacion") ?? "anterior");
  const resuelto = resolverPeriodo({
    desde: params.get("desde"),
    hasta: params.get("hasta"),
    preset,
    comparar: params.get("comparar"),
    comparacion: params.get("comparacion"),
  });

  function ir(patch: Record<string, string | null>) {
    router.push(conQuery(pathname, params, patch));
  }

  if (esListaProductos || esResumen || esDetalleProducto || esHorarios || esMiles) {
    return null;
  }

  return (
    <div>
      {esDetalleProducto ? (
        <Link href={conQuery("/admin/consumo/productos", params)} className="text-sm font-semibold" style={{ color: brand.green }}>
          ← Ventas por producto
        </Link>
      ) : null}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Analítica</p>
          <h1 className="font-display mt-1 text-2xl font-bold">{esDetalleProducto ? "Detalle del producto" : "Qué se vende en la caja"}</h1>
        </div>
        {frescura ? (
          <p
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: frescura.faltaAyer ? "#FEF3C7" : "#F3F4F6",
              color: frescura.faltaAyer ? "#92400E" : brand.ink,
            }}
          >
            {frescura.ultimaFecha
              ? frescura.faltaAyer
                ? `Falta la sesión de ayer. Última caja: ${formatDayKey(frescura.ultimaFecha)}`
                : `Caja al ${formatDayKey(frescura.ultimaFecha)}`
              : "Todavía no hay sesiones"}
          </p>
        ) : null}
      </div>

      {frescura && frescura.partesAbiertas > 0 ? (
        <p
          className="mt-3 rounded-md px-3 py-2 text-sm font-medium"
          style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
        >
          {frescura.partesAbiertas === 1
            ? "Hay 1 sesión en partes sin envío final."
            : `Hay ${frescura.partesAbiertas} sesiones en partes sin envío final.`}
        </p>
      ) : null}

      {esDetalleProducto ? null : (
      <nav className="mt-5 flex flex-wrap gap-1.5" aria-label="Analítica">
        {TABS.map((tab) => {
          const on = activo(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={conQuery(tab.href, params)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
              style={{ backgroundColor: on ? brand.green : "#F3F4F6", color: on ? "#FFFFFF" : brand.ink }}
            >
              {tab.label}
              {tab.href === "/admin/consumo/calidad" && frescura && frescura.pendientes > 0 ? (
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: on ? "#FDE68A" : "#F79521" }} />
              ) : null}
            </Link>
          );
        })}
      </nav>
      )}

      {muestraPeriodo ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          {(
            [
              ["7d", "7 días"],
              ["30d", "30 días"],
              ["mes", "Mes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                const siguiente = resolverPeriodo({ preset: id, comparar: params.get("comparar"), comparacion: params.get("comparacion") });
                ir({ preset: id, desde: siguiente.desde, hasta: siguiente.hasta });
              }}
              className="rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
              style={{ backgroundColor: preset === id ? "#111827" : "#F3F4F6", color: preset === id ? "#FFFFFF" : brand.ink }}
            >
              {label}
            </button>
          ))}
          <label className="text-xs font-medium text-brand-muted">
            Desde
            <input
              type="date"
              value={params.get("desde") || resuelto.desde}
              onChange={(event) => ir({ preset: "custom", desde: event.target.value || null })}
              className="mt-1 block rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
            />
          </label>
          <label className="text-xs font-medium text-brand-muted">
            Hasta
            <input
              type="date"
              value={params.get("hasta") || resuelto.hasta}
              onChange={(event) => ir({ preset: "custom", hasta: event.target.value || null })}
              className="mt-1 block rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
            />
          </label>
          {(
            [
              ["anterior", "Periodo anterior"],
              ["semana", "Mismos días"],
              ["anio", "Año anterior"],
              ["off", "Sin comparar"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => ir(id === "off" ? { comparar: "0", comparacion: null } : { comparar: null, comparacion: id })}
              className="rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
              style={{ backgroundColor: comparacion === id ? brand.paleGreen : "#F3F4F6", color: brand.ink }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {muestraPeriodo ? (
        <p className="mt-3 text-xs text-brand-muted">
          Periodo principal: {formatDayKey(resuelto.desde)} – {formatDayKey(resuelto.hasta)}.
          {resuelto.comparar && resuelto.tramo ? (
            <>
              {" "}
              Comparado: {formatDayKey(resuelto.anterior.desde)} – {formatDayKey(resuelto.anterior.hasta)}. {resuelto.algoritmo}
              {resuelto.recortado ? " El día en curso queda fuera de la comparación." : ""}
            </>
          ) : (
            <> Sin periodo comparado.</>
          )}
        </p>
      ) : null}
    </div>
  );
}
