"use client";

import { useCallback, useEffect, useState } from "react";
import { NCF_TIPOS, type NegocioFiscal, type NcfTipo } from "@/lib/pos-fiscal";
import { brand } from "@/lib/theme";

const inputClass =
  "h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-[#7EB341]";
const fieldClass = `mt-1.5 ${inputClass}`;
const labelClass = "block text-[13px] font-semibold text-brand-ink";
const hintClass = "mt-1 text-[13px] leading-snug text-brand-muted";

type FiscalResponse = {
  negocio: NegocioFiscal;
  persistido: boolean;
  emitidos: number;
};

type Draft = {
  nombreComercial: string;
  razonSocial: string;
  rnc: string;
  direccion: string;
  telefono: string;
  ncfTipo: "" | NcfTipo;
  ncfSiguiente: string;
  ncfHasta: string;
  ncfVence: string;
};

function draftFrom(negocio: NegocioFiscal): Draft {
  return {
    nombreComercial: negocio.nombreComercial,
    razonSocial: negocio.razonSocial,
    rnc: negocio.rnc ?? "",
    direccion: negocio.direccion,
    telefono: negocio.telefono ?? "",
    ncfTipo: negocio.ncfTipo ?? "",
    ncfSiguiente: negocio.ncfSiguiente == null ? "" : String(negocio.ncfSiguiente),
    ncfHasta: negocio.ncfHasta == null ? "" : String(negocio.ncfHasta),
    ncfVence: negocio.ncfVence ?? "",
  };
}

export function AdminFiscal() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [persistido, setPersistido] = useState(true);
  const [emitidos, setEmitidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/fiscal", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as (FiscalResponse & { error?: string }) | null;
      if (!response.ok || !body?.negocio) {
        throw new Error(body?.error || "No pudimos cargar los datos del negocio");
      }
      setDraft(draftFrom(body.negocio));
      setPersistido(body.persistido);
      setEmitidos(body.emitidos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar los datos del negocio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(partial: Partial<Draft>) {
    setSaved(false);
    setDraft((current) => (current ? { ...current, ...partial } : current));
  }

  async function save() {
    if (!draft) {
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/fiscal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await response.json().catch(() => null)) as (FiscalResponse & { error?: string }) | null;
      if (!response.ok || !body?.negocio) {
        throw new Error(body?.error || "No pudimos guardar");
      }
      setDraft(draftFrom(body.negocio));
      setPersistido(true);
      setEmitidos(body.emitidos);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar");
    } finally {
      setSaving(false);
    }
  }

  const agotada =
    draft?.ncfSiguiente !== "" &&
    draft?.ncfHasta !== "" &&
    Number(draft?.ncfSiguiente) === Number(draft?.ncfHasta) + 1;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Admin</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Datos fiscales</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-muted">
        Estos datos salen en el recibo de la caja. El NCF se asigna solo cuando cargas el rango autorizado. Sin rango, el
        recibo lleva el negocio y no imprime un comprobante.
      </p>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading || !draft ? (
        <div className="mt-6 h-64 animate-pulse rounded-[24px] bg-gray-100" />
      ) : (
        <section className="mt-6 rounded-[24px] border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
          {!persistido ? (
            <p className="mb-5 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FFF6EB", color: brand.ink }}>
              La ficha todavía no está en la base. El recibo usa el nombre, la dirección y el teléfono de la tienda, y no
              puede guardar el RNC hasta correr la migración.
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Nombre comercial
              <input
                value={draft.nombreComercial}
                onChange={(event) => patch({ nombreComercial: event.target.value })}
                className={fieldClass}
                style={{ borderColor: "#E5E7EB", color: brand.ink }}
              />
              <span className={hintClass}>La línea grande del ticket. Hoy es QUICK!.</span>
            </label>
            <label className={labelClass}>
              Razón social
              <input
                value={draft.razonSocial}
                onChange={(event) => patch({ razonSocial: event.target.value })}
                className={fieldClass}
                style={{ borderColor: "#E5E7EB", color: brand.ink }}
              />
              <span className={hintClass}>El nombre legal, debajo del comercial.</span>
            </label>
            <label className={labelClass}>
              RNC
              <input
                inputMode="numeric"
                value={draft.rnc}
                onChange={(event) => patch({ rnc: event.target.value })}
                className={fieldClass}
                style={{ borderColor: "#E5E7EB", color: brand.ink }}
                placeholder="9 u 11 dígitos"
              />
              <span className={hintClass}>Si lo dejas vacío, el recibo no imprime RNC.</span>
            </label>
            <label className={labelClass}>
              Teléfono
              <input
                value={draft.telefono}
                onChange={(event) => patch({ telefono: event.target.value })}
                className={fieldClass}
                style={{ borderColor: "#E5E7EB", color: brand.ink }}
              />
            </label>
          </div>
          <label className={`${labelClass} mt-5`}>
            Dirección
            <input
              value={draft.direccion}
              onChange={(event) => patch({ direccion: event.target.value })}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>

          <div className="mt-8 border-t pt-6" style={{ borderColor: "#E5E7EB" }}>
            <h2 className="font-display text-lg font-bold">Secuencia de NCF</h2>
            <p className={hintClass}>
              B02 es consumo en papel. E32 es consumo electrónico. El siguiente número se reserva al sincronizar la venta
              y no se repite si el ticket se reintenta.
              {emitidos > 0 ? ` Ya hay ${emitidos === 1 ? "1 comprobante emitido" : `${emitidos} comprobantes emitidos`}.` : ""}
            </p>
            {agotada ? (
              <p className="mt-3 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FFF6EB", color: brand.ink }}>
                Esta secuencia se agotó. Sube el hasta o carga un rango nuevo antes de seguir cobrando con NCF.
              </p>
            ) : null}
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className={labelClass}>
                Tipo
                <select
                  value={draft.ncfTipo}
                  onChange={(event) => {
                    const ncfTipo = event.target.value as Draft["ncfTipo"];
                    patch(ncfTipo ? { ncfTipo } : { ncfTipo, ncfSiguiente: "", ncfHasta: "", ncfVence: "" });
                  }}
                  className={fieldClass}
                  style={{ borderColor: "#E5E7EB", color: brand.ink }}
                  disabled={emitidos > 0}
                >
                  <option value="">Sin NCF</option>
                  {NCF_TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo === "B02" ? "B02 · consumo" : "E32 · e-CF consumo"}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Válido hasta
                <input
                  type="date"
                  value={draft.ncfVence}
                  onChange={(event) => patch({ ncfVence: event.target.value })}
                  className={fieldClass}
                  style={{ borderColor: "#E5E7EB", color: brand.ink }}
                />
              </label>
              <label className={labelClass}>
                Desde
                <input
                  inputMode="numeric"
                  value={draft.ncfSiguiente}
                  onChange={(event) => patch({ ncfSiguiente: event.target.value })}
                  className={fieldClass}
                  style={{ borderColor: "#E5E7EB", color: brand.ink }}
                />
                <span className={hintClass}>
                  El próximo número, sin el prefijo. 1 imprime {draft.ncfTipo === "E32" ? "E320000000001" : "B0200000001"}.
                </span>
              </label>
              <label className={labelClass}>
                Hasta
                <input
                  inputMode="numeric"
                  value={draft.ncfHasta}
                  onChange={(event) => patch({ ncfHasta: event.target.value })}
                  className={fieldClass}
                  style={{ borderColor: "#E5E7EB", color: brand.ink }}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !persistido}
              className="h-11 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: brand.green }}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            {saved ? <p className="text-sm font-semibold text-brand-muted">Listo. El próximo recibo usa estos datos.</p> : null}
          </div>
        </section>
      )}
    </div>
  );
}
