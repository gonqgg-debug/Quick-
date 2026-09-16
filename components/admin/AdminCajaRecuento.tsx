"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatCajaMoney, isNearZero, type CajaMoneda } from "@/lib/admin-caja-shared";
import type { CajaAsignacionSugerida, CajaBalances } from "@/lib/caja";
import { toMoney } from "@/lib/money";
import { brand } from "@/lib/theme";
import { AdminInput } from "@/components/admin/AdminField";

const INK = "#111827";
const MUTED = "#6B7280";
const GREEN = brand.green;
const RED = brand.error;
const DOP_DENOMS = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1] as const;
const USD_DENOMS = [100, 50, 20, 10, 5, 1] as const;
const DRAFT_STORAGE_KEY = "quick.admin.caja.recuento.v2";
const LEGACY_DRAFT_STORAGE_KEY = "quick.admin.caja.recuento.v1";

type Counts<T extends number> = Record<T, string>;
type MobileTab = "dop" | "usd";
type DopModo = "Fuerte" | "Chica" | "Ajuste";
type DopDenom = (typeof DOP_DENOMS)[number];
type UsdDenom = (typeof USD_DENOMS)[number];
type DopCountsMap = Record<DopModo, Counts<DopDenom>>;

type RecuentoDraft = {
  dopModo: DopModo;
  mobileTab: MobileTab;
  dopCounts: DopCountsMap;
  usdCounts: Counts<UsdDenom>;
};

let memoryDraft: RecuentoDraft | null = null;

function emptyCounts<T extends number>(denoms: readonly T[]): Counts<T> {
  return Object.fromEntries(denoms.map((denom) => [denom, ""])) as Counts<T>;
}

function parseStoredCounts<T extends number>(denoms: readonly T[], raw: unknown): Counts<T> {
  const counts = emptyCounts(denoms);
  if (!raw || typeof raw !== "object") {
    return counts;
  }
  const record = raw as Record<string, unknown>;
  for (const denom of denoms) {
    const value = record[String(denom)];
    if (typeof value === "string") {
      counts[denom] = sanitizeCount(value);
    }
  }
  return counts;
}

function emptyDopCountsMap(): DopCountsMap {
  return {
    Fuerte: emptyCounts(DOP_DENOMS),
    Chica: emptyCounts(DOP_DENOMS),
    Ajuste: emptyCounts(DOP_DENOMS),
  };
}

function parseDopModo(value: unknown): DopModo {
  return value === "Chica" || value === "Ajuste" ? value : "Fuerte";
}

function emptyDraft(): RecuentoDraft {
  return {
    dopModo: "Fuerte",
    mobileTab: "dop",
    dopCounts: emptyDopCountsMap(),
    usdCounts: emptyCounts(USD_DENOMS),
  };
}

function parseDraft(raw: unknown): RecuentoDraft | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const dopCounts = emptyDopCountsMap();
  if (record.dopCounts && typeof record.dopCounts === "object" && !Array.isArray(record.dopCounts)) {
    const grouped = record.dopCounts as Record<string, unknown>;
    if (grouped.Fuerte || grouped.Chica || grouped.Ajuste) {
      dopCounts.Fuerte = parseStoredCounts(DOP_DENOMS, grouped.Fuerte);
      dopCounts.Chica = parseStoredCounts(DOP_DENOMS, grouped.Chica);
      dopCounts.Ajuste = parseStoredCounts(DOP_DENOMS, grouped.Ajuste);
    } else {
      const legacy = parseStoredCounts(DOP_DENOMS, grouped);
      const modo = parseDopModo(record.cajaDop ?? record.dopModo);
      dopCounts[modo] = legacy;
    }
  }
  return {
    dopModo: parseDopModo(record.dopModo ?? record.cajaDop),
    mobileTab: record.mobileTab === "usd" ? "usd" : "dop",
    dopCounts,
    usdCounts: parseStoredCounts(USD_DENOMS, record.usdCounts),
  };
}

function readStoredDraft(): RecuentoDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY) ?? window.sessionStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseDraft(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function loadDraft(): RecuentoDraft {
  if (memoryDraft) {
    return memoryDraft;
  }
  const stored = readStoredDraft();
  if (stored) {
    memoryDraft = stored;
    return stored;
  }
  return emptyDraft();
}

function persistDraft(draft: RecuentoDraft) {
  memoryDraft = draft;
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    window.sessionStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
  } catch {
    // Private mode or quota: in-memory draft still survives tab switches in this session.
  }
}

function clearDraft() {
  memoryDraft = null;
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage failures on reset.
  }
}

function countsHaveValue<T extends number>(counts: Counts<T>): boolean {
  return Object.values(counts).some((value) => String(value).trim() !== "");
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
  const [dopModo, setDopModo] = useState<DopModo>("Fuerte");
  const [dopCounts, setDopCounts] = useState<DopCountsMap>(() => emptyDopCountsMap());
  const [usdCounts, setUsdCounts] = useState(() => emptyCounts(USD_DENOMS));
  const [mobileTab, setMobileTab] = useState<MobileTab>("dop");
  const [ready, setReady] = useState(false);
  const [balances, setBalances] = useState<CajaBalances | null>(null);
  const [asignacion, setAsignacion] = useState<CajaAsignacionSugerida | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const draft = loadDraft();
    setDopModo(draft.dopModo);
    setDopCounts(draft.dopCounts);
    setUsdCounts(draft.usdCounts);
    setMobileTab(draft.mobileTab);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    persistDraft({ dopModo, mobileTab, dopCounts, usdCounts });
  }, [ready, dopModo, mobileTab, dopCounts, usdCounts]);

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
          throw new Error(body?.error || "No pudimos cargar el saldo esperado");
        }
        if (!cancelled) {
          setBalances(body?.balances ?? null);
          setAsignacion(body?.asignacion ?? null);
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

  const dopCountsActivos = dopCounts[dopModo];
  const totalDop = useMemo(() => totalFrom(DOP_DENOMS, dopCountsActivos), [dopCountsActivos]);
  const totalUsd = useMemo(() => totalFrom(USD_DENOMS, usdCounts), [usdCounts]);
  const esperadoDop =
    dopModo === "Ajuste"
      ? (asignacion?.recomendadoMoverAChica ?? null)
      : dopModo === "Chica"
        ? (balances?.chicaDop ?? null)
        : (balances?.fuerteDop ?? null);
  const esperadoUsd = balances?.fuerteUsd ?? null;
  const canReset =
    countsHaveValue(dopCounts.Fuerte) ||
    countsHaveValue(dopCounts.Chica) ||
    countsHaveValue(dopCounts.Ajuste) ||
    countsHaveValue(usdCounts);

  function resetRecuento() {
    const next = emptyDraft();
    setDopModo(next.dopModo);
    setDopCounts(next.dopCounts);
    setUsdCounts(next.usdCounts);
    setMobileTab(next.mobileTab);
    clearDraft();
  }

  return (
    <div>
      <p className="text-sm" style={{ color: MUTED }}>
        El recuento se queda guardado si cambias de pestaña. Usa Resetear para borrar todo.
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
            counts={dopCountsActivos}
            onCountChange={(denom, value) =>
              setDopCounts((current) => ({
                ...current,
                [dopModo]: { ...current[dopModo], [denom]: sanitizeCount(value) },
              }))
            }
            total={totalDop}
            esperado={esperadoDop}
            esperadoLabel={dopModo === "Ajuste" ? "Para llenar chica" : "Saldo esperado"}
            loadingEsperado={loading}
            header={
              <div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Caja del recuento DOP">
                  <CajaChoice active={dopModo === "Fuerte"} onClick={() => setDopModo("Fuerte")}>
                    Caja Fuerte
                  </CajaChoice>
                  <CajaChoice active={dopModo === "Chica"} onClick={() => setDopModo("Chica")}>
                    Caja Chica
                  </CajaChoice>
                  <CajaChoice active={dopModo === "Ajuste"} onClick={() => setDopModo("Ajuste")}>
                    Ajuste Caja Chica
                  </CajaChoice>
                </div>
                {dopModo === "Ajuste" ? (
                  <p className="mt-3 text-sm" style={{ color: MUTED }}>
                    Cuenta lo que vas a mover a caja chica para dejarla llena
                    {asignacion
                      ? ` (objetivo ${formatCajaMoney(asignacion.objetivoCajaChica, "DOP")}, saldo ${formatCajaMoney(asignacion.saldoEsperadoChica, "DOP")}).`
                      : "."}
                  </p>
                ) : null}
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

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={resetRecuento}
          disabled={!canReset}
          className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
          style={{ minHeight: 44, border: "1px solid #E5E7EB", color: INK, backgroundColor: "#FFFFFF" }}
        >
          Resetear recuento
        </button>
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
  esperadoLabel = "Saldo esperado",
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
  esperadoLabel?: string;
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
          label={esperadoLabel}
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
