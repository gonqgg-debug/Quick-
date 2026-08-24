"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatMetaMes,
  monthInputValue,
  monthStartFromInput,
  pesosSumaPercent,
  pesosSumanUno,
  ratioToPercent,
  type MetaMensual,
  type ParametrosConfig,
} from "@/lib/admin-parametros-shared";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";

const inputClass =
  "h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-[#7EB341]";
const fieldClass = `mt-1.5 ${inputClass}`;
const labelClass = "block text-[13px] font-semibold text-brand-ink";
const hintClass = "mt-1 text-[13px] leading-snug text-brand-muted";

type Draft = {
  mesActivo: string;
  ratioRecompra: string;
  umbralCuidado: string;
  umbralStop: string;
  pesoReciente: string;
  pesoIntermedio: string;
  pesoAntiguo: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function draftFrom(config: ParametrosConfig): Draft {
  return {
    mesActivo: monthInputValue(config.mesActivo),
    ratioRecompra: String(config.ratioRecompra),
    umbralCuidado: String(ratioToPercent(config.umbralCuidado)),
    umbralStop: String(ratioToPercent(config.umbralStop)),
    pesoReciente: String(ratioToPercent(config.pesoReciente)),
    pesoIntermedio: String(ratioToPercent(config.pesoIntermedio)),
    pesoAntiguo: String(ratioToPercent(config.pesoAntiguo)),
  };
}

function parsePercentField(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") {
    return null;
  }
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) {
    return null;
  }
  return amount / 100;
}

function parseRatioField(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") {
    return null;
  }
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || !(amount > 0)) {
    return null;
  }
  return amount;
}

function nextMonthInput(metas: MetaMensual[]): string {
  const latest = metas[0]?.mes;
  if (!latest) {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }
  const year = Number(latest.slice(0, 4));
  const month = Number(latest.slice(5, 7));
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${pad2(month + 1)}`;
}

export function AdminParametros() {
  const router = useRouter();
  const [config, setConfig] = useState<ParametrosConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [metas, setMetas] = useState<MetaMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [metaModal, setMetaModal] = useState<{ mes: string | null; meta: string } | null>(null);

  const load = useCallback(async () => {
    const [parametrosRes, metasRes] = await Promise.all([
      fetch("/api/admin/parametros", { credentials: "include" }),
      fetch("/api/admin/metas", { credentials: "include" }),
    ]);
    if (parametrosRes.status === 401 || metasRes.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const parametrosBody = (await parametrosRes.json().catch(() => null)) as
      | { parametros?: ParametrosConfig; error?: string }
      | null;
    const metasBody = (await metasRes.json().catch(() => null)) as { metas?: MetaMensual[]; error?: string } | null;
    if (!parametrosRes.ok || !parametrosBody?.parametros) {
      throw new Error(parametrosBody?.error || "No pudimos cargar los parámetros");
    }
    if (!metasRes.ok) {
      throw new Error(metasBody?.error || "No pudimos cargar las metas");
    }
    setConfig(parametrosBody.parametros);
    setDraft(draftFrom(parametrosBody.parametros));
    setMetas(metasBody?.metas ?? []);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
        if (!cancelled) {
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
  }, [load]);

  const pesos = useMemo(() => {
    if (!draft) {
      return { reciente: null as number | null, intermedio: null as number | null, antiguo: null as number | null };
    }
    return {
      reciente: parsePercentField(draft.pesoReciente),
      intermedio: parsePercentField(draft.pesoIntermedio),
      antiguo: parsePercentField(draft.pesoAntiguo),
    };
  }, [draft]);

  const pesosOk =
    pesos.reciente != null &&
    pesos.intermedio != null &&
    pesos.antiguo != null &&
    pesosSumanUno(pesos.reciente, pesos.intermedio, pesos.antiguo);
  const pesosTotal =
    pesos.reciente != null && pesos.intermedio != null && pesos.antiguo != null
      ? pesosSumaPercent(pesos.reciente, pesos.intermedio, pesos.antiguo)
      : null;

  async function saveParametros() {
    if (!draft) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/parametros", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesActivo: draft.mesActivo,
          ratioRecompra: parseRatioField(draft.ratioRecompra),
          umbralCuidado: parsePercentField(draft.umbralCuidado),
          umbralStop: parsePercentField(draft.umbralStop),
          pesoReciente: pesos.reciente,
          pesoIntermedio: pesos.intermedio,
          pesoAntiguo: pesos.antiguo,
        }),
      });
      const body = (await response.json().catch(() => null)) as { parametros?: ParametrosConfig; error?: string } | null;
      if (!response.ok || !body?.parametros) {
        throw new Error(body?.error || "No pudimos guardar los parámetros");
      }
      setConfig(body.parametros);
      setDraft(draftFrom(body.parametros));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "No pudimos guardar los parámetros");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Admin</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Parámetros</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-muted">
        Se usa poco — más o menos una vez al mes. Cada campo tiene una nota para que no tengas que acordarte qué hace.
      </p>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading || !draft ? (
        <div className="mt-6 h-64 animate-pulse rounded-[24px] bg-gray-100" />
      ) : (
        <>
          <section className="mt-6 rounded-[24px] border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
            <h2 className="font-display text-lg font-bold">Configuración general</h2>
            <p className="mt-1 text-sm text-brand-muted">Edita la fila única de parámetros que usa todo el dashboard.</p>

            <div
              className="mt-5 rounded-2xl border px-4 py-4"
              style={{ borderColor: brand.orange, backgroundColor: "#FFF6EB" }}
            >
              <label className={labelClass}>
                Mes activo
                <input
                  type="month"
                  value={draft.mesActivo}
                  onChange={(event) => setDraft((current) => (current ? { ...current, mesActivo: event.target.value } : current))}
                  className={fieldClass}
                  style={{ borderColor: "#F3D5A8", color: brand.ink, maxWidth: 220 }}
                />
              </label>
              <p className={hintClass}>
                Este mes es el que usa <strong>Hoy</strong> y todos los cálculos de presupuesto (ventas, meta, compras,
                disponible). Si lo cambias, cambia todo el dashboard.
              </p>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <label className={labelClass}>
                Ratio de recompra
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  inputMode="decimal"
                  value={draft.ratioRecompra}
                  onChange={(event) => setDraft((current) => (current ? { ...current, ratioRecompra: event.target.value } : current))}
                  className={fieldClass}
                  style={{ borderColor: "#E5E7EB", color: brand.ink }}
                />
                <span className={hintClass}>
                  Cuánto puedes gastar en compras por cada $1 de venta esperada. Con 1.5, el presupuesto es venta ÷ 1.5.
                </span>
              </label>
              <label className={labelClass}>
                Umbral cuidado
                <div className="relative mt-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    inputMode="decimal"
                    value={draft.umbralCuidado}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, umbralCuidado: event.target.value } : current))
                    }
                    className={`${inputClass} pr-8`}
                    style={{ borderColor: "#E5E7EB", color: brand.ink }}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-muted">
                    %
                  </span>
                </div>
                <span className={hintClass}>Cuando las compras llegan a este % del presupuesto, Hoy se pone naranja.</span>
              </label>
              <label className={labelClass}>
                Umbral stop
                <div className="relative mt-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    inputMode="decimal"
                    value={draft.umbralStop}
                    onChange={(event) => setDraft((current) => (current ? { ...current, umbralStop: event.target.value } : current))}
                    className={`${inputClass} pr-8`}
                    style={{ borderColor: "#E5E7EB", color: brand.ink }}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-muted">
                    %
                  </span>
                </div>
                <span className={hintClass}>Cuando llegan a este %, Hoy se pone rojo: deja de comprar.</span>
              </label>
            </div>

            <div className="mt-6">
              <p className={labelClass}>Pesos del promedio ponderado</p>
              <p className={hintClass}>
                Qué tanto cuenta cada uno de los 3 meses anteriores al mes activo, al armar el promedio de ventas por día
                de semana. Los tres tienen que sumar 100%.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <PesoField
                  label="Mes más reciente"
                  hint="M-1, el mes de atrás"
                  value={draft.pesoReciente}
                  onChange={(value) => setDraft((current) => (current ? { ...current, pesoReciente: value } : current))}
                />
                <PesoField
                  label="Mes intermedio"
                  hint="M-2"
                  value={draft.pesoIntermedio}
                  onChange={(value) => setDraft((current) => (current ? { ...current, pesoIntermedio: value } : current))}
                />
                <PesoField
                  label="Mes más antiguo"
                  hint="M-3"
                  value={draft.pesoAntiguo}
                  onChange={(value) => setDraft((current) => (current ? { ...current, pesoAntiguo: value } : current))}
                />
              </div>
              <p
                className="mt-3 rounded-2xl px-3 py-2 text-sm font-semibold"
                style={
                  pesosOk
                    ? { backgroundColor: "#F4F9EC", color: brand.green }
                    : { backgroundColor: "#FEE2E2", color: brand.error }
                }
              >
                {pesosTotal == null
                  ? "Completa los tres pesos. Tienen que sumar 100%."
                  : pesosOk
                    ? `Total: ${pesosTotal}%`
                    : `Total: ${pesosTotal}% — tiene que sumar 100% para poder guardar.`}
              </p>
            </div>

            {saveError ? (
              <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
                {saveError}
              </p>
            ) : null}
            {saved ? (
              <p className="mt-4 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: "#F4F9EC", color: brand.green }}>
                Cambios guardados. Hoy ya usa esta configuración.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void saveParametros()}
              disabled={
                saving ||
                !pesosOk ||
                !monthStartFromInput(draft.mesActivo) ||
                parseRatioField(draft.ratioRecompra) == null ||
                parsePercentField(draft.umbralCuidado) == null ||
                parsePercentField(draft.umbralStop) == null
              }
              className="mt-5 rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
              style={{ minHeight: 44, backgroundColor: brand.green }}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </section>

          <section className="mt-6 rounded-[24px] border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Metas mensuales</h2>
                <p className="mt-1 text-sm text-brand-muted">
                  La meta del mes activo es la que Hoy compara contra las ventas. Cuando abras un mes nuevo, agrégala aquí.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMetaModal({ mes: nextMonthInput(metas), meta: "" })}
                className="rounded-full px-4 text-sm font-bold text-white"
                style={{ minHeight: 44, backgroundColor: brand.green }}
              >
                Agregar meta
              </button>
            </div>

            {metas.length === 0 ? (
              <div className="mt-5 rounded-[24px] px-5 py-10 text-center" style={{ backgroundColor: "#F8FAF7" }}>
                <p className="font-display text-xl font-bold">Todavía no hay metas</p>
                <p className="mt-2 text-sm text-brand-muted">Agrega la del mes que vas a operar.</p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-[20px] border" style={{ borderColor: "#E5E7EB" }}>
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
                      <th className="px-4 py-3">Mes</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Meta</th>
                      <th className="w-24 px-4 py-3">
                        <span className="sr-only">Editar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {metas.map((item, index) => {
                      const isActive = config?.mesActivo === item.mes;
                      return (
                        <tr key={item.mes} style={{ backgroundColor: index % 2 === 1 ? "#FAFBFA" : "#FFFFFF" }}>
                          <td className="px-4 py-3 font-semibold">
                            {formatMetaMes(item.mes)}
                            {isActive ? (
                              <span
                                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                                style={{ backgroundColor: brand.green }}
                              >
                                Activo
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{formatPrice(item.meta)}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setMetaModal({ mes: monthInputValue(item.mes), meta: String(item.meta) })}
                              className="text-sm font-bold"
                              style={{ color: brand.green }}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <p className="mt-8 text-center text-sm">
        <Link href="/admin/diagnostico" className="text-brand-muted underline-offset-2 hover:underline">
          Ver diagnóstico de cálculo
        </Link>
      </p>

      {metaModal ? (
        <MetaModal
          existing={new Set(metas.map((item) => monthInputValue(item.mes)))}
          draft={metaModal}
          onClose={() => setMetaModal(null)}
          onSaved={(savedMeta, isNew) => {
            setMetas((current) => {
              const next = isNew
                ? [savedMeta, ...current.filter((item) => item.mes !== savedMeta.mes)]
                : current.map((item) => (item.mes === savedMeta.mes ? savedMeta : item));
              return [...next].sort((left, right) => right.mes.localeCompare(left.mes));
            });
            setMetaModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PesoField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={labelClass}>
      {label}
      <div className="relative mt-1.5">
        <input
          type="number"
          min={0}
          max={100}
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-8`}
          style={{ borderColor: "#E5E7EB", color: brand.ink }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-muted">
          %
        </span>
      </div>
      <span className={hintClass}>{hint}</span>
    </label>
  );
}

function MetaModal({
  existing,
  draft,
  onClose,
  onSaved,
}: {
  existing: Set<string>;
  draft: { mes: string | null; meta: string };
  onClose: () => void;
  onSaved: (meta: MetaMensual, isNew: boolean) => void;
}) {
  const isNew = !draft.mes || !existing.has(draft.mes);
  const [mes, setMes] = useState(draft.mes ?? "");
  const [meta, setMeta] = useState(draft.meta);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const mesKey = monthStartFromInput(mes);
      if (!mesKey) {
        throw new Error("El mes no es válido");
      }
      const isCreate = !existing.has(monthInputValue(mesKey));
      const response = await fetch(isCreate ? "/api/admin/metas" : `/api/admin/metas/${mesKey}`, {
        method: isCreate ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isCreate ? { mes: mesKey, meta } : { meta }),
      });
      const body = (await response.json().catch(() => null)) as { meta?: MetaMensual; error?: string } | null;
      if (!response.ok || !body?.meta) {
        throw new Error(body?.error || "No pudimos guardar la meta");
      }
      onSaved(body.meta, isCreate);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No pudimos guardar la meta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Cerrar" onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="meta-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Metas</p>
        <h2 id="meta-title" className="font-display mt-1 text-2xl font-bold">
          {isNew ? "Agregar meta" : "Editar meta"}
        </h2>

        <label className={`${labelClass} mt-5`}>
          Mes
          <input
            type="month"
            required
            disabled={!isNew}
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className={fieldClass}
            style={{ borderColor: "#E5E7EB", color: brand.ink, opacity: isNew ? 1 : 0.7 }}
          />
        </label>
        <label className={`${labelClass} mt-4`}>
          Meta
          <input
            ref={inputRef}
            required
            inputMode="decimal"
            value={meta}
            onChange={(event) => setMeta(event.target.value)}
            placeholder="2500000"
            className={fieldClass}
            style={{ borderColor: "#E5E7EB", color: brand.ink }}
          />
          <span className={hintClass}>Monto del mes, en pesos. Ej. 2500000.</span>
        </label>

        {formError ? (
          <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
            {formError}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 text-sm font-bold"
            style={{ minHeight: 44, border: "1px solid #E5E7EB", color: brand.ink }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !mes || !meta.trim()}
            className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
            style={{ minHeight: 44, backgroundColor: brand.green }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
