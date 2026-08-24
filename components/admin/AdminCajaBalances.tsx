"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCajaMoney, formatUsd, isNearZero } from "@/lib/admin-caja-shared";
import type { CajaAsignacionSugerida, CajaBalances } from "@/lib/caja";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";

const INK = "#111827";
const MUTED = "#6B7280";

export function AdminCajaBalances() {
  const router = useRouter();
  const [balances, setBalances] = useState<CajaBalances | null>(null);
  const [asignacion, setAsignacion] = useState<CajaAsignacionSugerida | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/caja/balances", { credentials: "include" });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const body = (await response.json().catch(() => null)) as
          | { balances?: CajaBalances; asignacion?: CajaAsignacionSugerida; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(body?.error || "No pudimos cargar los balances");
        }
        if (!cancelled) {
          setBalances(body?.balances ?? null);
          setAsignacion(body?.asignacion ?? null);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-[24px] bg-gray-100" />;
  }

  if (error || !balances || !asignacion) {
    return (
      <p className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
        {error || "No pudimos cargar los balances"}
      </p>
    );
  }

  const hayMovimiento = !isNearZero(asignacion.recomendadoMoverAChica);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <BalanceCard title="Caja chica" moneda="DOP" saldo={balances.chicaDop} />
        <BalanceCard title="Caja fuerte" moneda="DOP" saldo={balances.fuerteDop} />
        <BalanceCard title="Caja fuerte" moneda="USD" saldo={balances.fuerteUsd} usd />
      </div>

      <section className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
          Asignación sugerida
        </p>
        <p className="mt-2 text-base font-medium" style={{ color: INK }}>
          {hayMovimiento
            ? `Podrías mover ${formatPrice(asignacion.recomendadoMoverAChica)} de Fuerte a Chica para alcanzar el objetivo.`
            : "Caja chica ya está en el objetivo o por encima. No hace falta mover DOP desde Fuerte."}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Hint label="Objetivo chica" value={formatPrice(asignacion.objetivoCajaChica)} />
          <Hint label="Saldo actual chica" value={formatPrice(asignacion.saldoEsperadoChica)} />
          <Hint label="A mover" value={formatPrice(asignacion.recomendadoMoverAChica)} />
          <Hint label="Fuerte después" value={formatPrice(asignacion.fuerteEstimadoPostMovimiento)} />
        </dl>
      </section>

      <p className="text-sm" style={{ color: MUTED }}>
        Los USD nunca se mueven a caja chica.
        {asignacion.usdEnFuerte ? ` Hay ${formatUsd(asignacion.usdEnFuerte)} en caja fuerte.` : ""}
      </p>
    </div>
  );
}

function BalanceCard({
  title,
  moneda,
  saldo,
  usd = false,
}: {
  title: string;
  moneda: string;
  saldo: number;
  usd?: boolean;
}) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
        {title} · {moneda}
      </p>
      <p className="mt-2 text-4xl font-semibold tabular-nums sm:text-5xl" style={{ color: INK }}>
        {usd ? formatUsd(saldo) : formatCajaMoney(saldo, "DOP")}
      </p>
      <p className="mt-1 text-xs" style={{ color: MUTED }}>
        Saldo esperado
      </p>
    </section>
  );
}

function Hint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums" style={{ color: INK }}>
        {value}
      </dd>
    </div>
  );
}
