"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDayKey } from "@/lib/local-day";
import type { FrescuraConsumo } from "@/lib/pos-consumo";
import { brand } from "@/lib/theme";

const TABS = [
  { href: "/admin/consumo", label: "Resumen" },
  { href: "/admin/consumo/productos", label: "Productos" },
  { href: "/admin/consumo/horarios", label: "Horarios" },
  { href: "/admin/consumo/canasta", label: "Canasta" },
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
  const muestraPeriodo = pathname === "/admin/consumo" || pathname.startsWith("/admin/consumo/productos") || pathname.startsWith("/admin/consumo/horarios");
  const preset = params.get("preset") ?? (params.get("desde") || params.get("hasta") ? "custom" : "7d");
  const comparar = params.get("comparar") !== "0";

  function ir(patch: Record<string, string | null>) {
    router.push(conQuery(pathname, params, patch));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Consumo</p>
          <h1 className="font-display mt-1 text-2xl font-bold">Qué se vende en la caja</h1>
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

      <nav className="mt-5 flex flex-wrap gap-1.5" aria-label="Consumo">
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
              onClick={() => ir({ preset: id, desde: null, hasta: null })}
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
              value={params.get("desde") ?? ""}
              onChange={(event) => ir({ preset: "custom", desde: event.target.value || null })}
              className="mt-1 block rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
            />
          </label>
          <label className="text-xs font-medium text-brand-muted">
            Hasta
            <input
              type="date"
              value={params.get("hasta") ?? ""}
              onChange={(event) => ir({ preset: "custom", hasta: event.target.value || null })}
              className="mt-1 block rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
            />
          </label>
          <button
            type="button"
            onClick={() => ir({ comparar: comparar ? "0" : null })}
            className="rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            style={{ backgroundColor: comparar ? brand.paleGreen : "#F3F4F6", color: brand.ink }}
          >
            {comparar ? "Comparando" : "Sin comparar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
