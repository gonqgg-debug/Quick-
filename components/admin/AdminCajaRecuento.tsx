"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatCajaMoney, isNearZero, type Caja, type CajaMoneda } from "@/lib/admin-caja-shared";
import type { CajaBalances } from "@/lib/caja";
import { toMoney } from "@/lib/money";
import { brand } from "@/lib/theme";
import { AdminInput } from "@/components/admin/AdminField";

const INK = "#111827";
const MUTED = "#6B7280";
const GREEN = brand.green;
const RED = brand.error;
const DOP_DENOMS = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1] as const;
const USD_DENOMS = [100, 50, 20, 10, 5, 1] as const;

type Counts<T extends number> = Record<T, string>;

function emptyCounts<T extends number>(denoms: readonly T[]): Counts<T> {
  return Object.fromEntries(denoms.map((denom) => [denom, ""])) as Counts<T>;
}

function parseCount(raw: string): number {
  if (!raw.trim()) {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function sanitizeCount(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function totalFrom<T extends number>(denoms: readonly T[], counts: Counts<T>): number {
  return denoms.reduce((sum, denom) => sum + denom * parseCount(counts[denom]), 0);
}

function formatSignedAmount(value: number, moneda: CajaMoneda): string {
  const amount = toMoney(value);
  if (isNearZero(amount)) {
    return formatCajaMoney(0, moneda);
  }
  const formatted = formatCajaMoney(Math.abs(amount), moneda);
  return amount > 0 ? `+${formatted}` : `−${formatted}`;
}

export function AdminCajaRecuento() {
  const router = useRouter();
  const [cajaDop, setCajaDop] = useState<Caja>("Fuerte");
  const [dopCounts, setDopCounts] = useState(() => emptyCounts(DOP_DENOMS));
  const [usdCounts, setUsdCounts] = useState(() => emptyCounts(USD_DENOMS));
  const [mobileTab, setMobileTab] = useState<"dop" | "usd">("dop");
  const [balances, setBalances] = useState<CajaBalances | null>(null);
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
        const body = (await response.json().catch(() => null)) as { balances?: CajaBalances; error?: string } | null;
        if (!response.ok) {
          throw new Error(body?.error || "No pudimos cargar el saldo esperado");
        }
        if (!cancelled) {
          setBalances(body?.balances ?? null);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No pudimos cargar el saldo esperado");
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

  const totalDop = useMemo(() => totalFrom(DOP_DENOMS, dopCounts), [dopCounts]);
  const totalUsd = useMemo(() => totalFrom(USD_DENOMS, usdCounts), [usdCounts]);
  const esperadoDop = cajaDop === "Chica" ? (balances?.chicaDop ?? null) : (balances?.fuerteDop ?? null);
  const esperadoUsd = balances?.fuerteUsd ?? null;

  return (
    <div>
      <p className="text-sm" style={{ color: MUTED }}>
        Calculadora de un solo uso: no se guarda nada. Si recargas, vuelve a cero.
      </p>
      {error ? (
        <p className="mt-4 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: RED }}>
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-1.5 lg:hidden" role="tablist" aria-label="Moneda del recuento">
        <MobileTabButton active={mobileTab === "dop"} onClick={() => setMobileTab("dop")}>
          Recuento DOP
        </MobileTabButton>
        <MobileTabButton active={mobileTab === "usd"} onClick={() => setMobileTab("usd")}>
          Recuento USD
        </MobileTabButton>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={mobileTab === "dop" ? "block" : "hidden lg:block"}>
          <RecuentoPanel
            title="Recuento DOP"
            moneda="DOP"
            denoms={DOP_DENOMS}
            counts={dopCounts}
            onCountChange={(denom, value) =>
              setDopCounts((current) => ({ ...current, [denom]: sanitizeCount(value) }))
            }
            total={totalDop}
            esperado={esperadoDop}
            loadingEsperado={loading}
            header={
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Caja del recuento DOP">
                <CajaChoice active={cajaDop === "Fuerte"} onClick={() => setCajaDop("Fuerte")}>
                  Caja Fuerte
                </CajaChoice>
                <CajaChoice active={cajaDop === "Chica"} onClick={() => setCajaDop("Chica")}>
                  Caja Chica
                </CajaChoice>
              </div>
            }
          />
        </div>
        <div className={mobileTab === "usd" ? "block" : "hidden lg:block"}>
          <RecuentoPanel
            title="Recuento USD"
            moneda="USD"
            denoms={USD_DENOMS}
            counts={usdCounts}
            onCountChange={(denom, value) =>
              setUsdCounts((current) => ({ ...current, [denom]: sanitizeCount(value) }))
            }
            total={totalUsd}
            esperado={esperadoUsd}
            loadingEsperado={loading}
            header={
              <p className="text-sm" style={{ color: MUTED }}>
                Siempre caja fuerte. Los USD no viven en caja chica.
              </p>
            }
          />
        </div>
      </div>
    </div>
  );
}

function RecuentoPanel<T extends number>({
  title,
  moneda,
  denoms,
  counts,
  onCountChange,
  total,
  esperado,
  loadingEsperado,
  header,
}: {
  title: string;
  moneda: CajaMoneda;
  denoms: readonly T[];
  counts: Counts<T>;
  onCountChange: (denom: T, value: string) => void;
  total: number;
  esperado: number | null;
  loadingEsperado: boolean;
  header: ReactNode;
}) {
  const diferencia = esperado == null ? null : total - esperado;
  const match = diferencia != null && isNearZero(diferencia);

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-5 shadow-sm sm:px-5">
      <h2 className="text-lg font-semibold" style={{ color: INK }}>
        {title}
      </h2>
      <div className="mt-3">{header}</div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
              <th className="pb-2 pr-3 font-medium">Denominación</th>
              <th className="pb-2 pr-3 font-medium">Cantidad</th>
              <th className="pb-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {denoms.map((denom) => {
              const qty = parseCount(counts[denom]);
              return (
                <tr key={denom} className="border-t border-[#F3F4F6]">
                  <td className="whitespace-nowrap py-2 pr-3 font-semibold tabular-nums" style={{ color: INK }}>
                    {formatCajaMoney(denom, moneda)}
                  </td>
                  <td className="py-2 pr-3">
                    <AdminInput
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label={`Cantidad de ${formatCajaMoney(denom, moneda)}`}
                      value={counts[denom]}
                      onChange={(event) => onCountChange(denom, event.target.value)}
                      placeholder="0"
                      bare
                      className="max-w-[7.5rem] tabular-nums"
                    />
                  </td>
                  <td className="whitespace-nowrap py-2 text-right tabular-nums" style={{ color: MUTED }}>
                    {formatCajaMoney(denom * qty, moneda)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="mt-5 space-y-2 border-t border-[#E5E7EB] pt-4">
        <SummaryRow label="Total contado" value={formatCajaMoney(total, moneda)} emphasize />
        <SummaryRow
          label="Saldo esperado"
          value={loadingEsperado ? "…" : esperado == null ? "—" : formatCajaMoney(esperado, moneda)}
        />
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
            Diferencia
          </dt>
          <dd
            className="text-lg font-semibold tabular-nums"
            style={{ color: diferencia == null || loadingEsperado ? MUTED : match ? GREEN : RED }}
          >
            {loadingEsperado || diferencia == null ? "—" : formatSignedAmount(diferencia, moneda)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${emphasize ? "text-xl font-semibold sm:text-2xl" : "text-sm font-medium"}`}
        style={{ color: INK }}
      >
        {value}
      </dd>
    </div>
  );
}

function CajaChoice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
      style={{
        backgroundColor: active ? GREEN : "#F3F4F6",
        color: active ? "#FFFFFF" : INK,
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function MobileTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
      style={{
        backgroundColor: active ? GREEN : "#F3F4F6",
        color: active ? "#FFFFFF" : INK,
      }}
    >
      {children}
    </button>
  );
}
