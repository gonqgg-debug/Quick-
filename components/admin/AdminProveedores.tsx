"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Proveedor } from "@/lib/admin-compras-shared";
import { brand } from "@/lib/theme";
import { AdminInput, AdminTextarea, adminLabelClass } from "@/components/admin/AdminField";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";

type Draft = {
  nombre: string;
  tieneCredito: boolean;
  diasCredito: string;
  notas: string;
};

function emptyDraft(): Draft {
  return { nombre: "", tieneCredito: false, diasCredito: "", notas: "" };
}

function draftFrom(proveedor: Proveedor): Draft {
  return {
    nombre: proveedor.nombre,
    tieneCredito: proveedor.tieneCredito,
    diasCredito: proveedor.tieneCredito && proveedor.diasCredito > 0 ? String(proveedor.diasCredito) : "",
    notas: proveedor.notas ?? "",
  };
}

export function AdminProveedores() {
  const router = useRouter();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Proveedor | "new" | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/proveedores", { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as { proveedores?: Proveedor[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar los proveedores");
    }
    setProveedores(body?.proveedores ?? []);
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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Compras</p>
          <h1 className="font-display mt-1 text-2xl font-bold">Proveedores</h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-full px-4 text-sm font-bold text-white"
          style={{ minHeight: 44, backgroundColor: brand.green }}
        >
          Agregar proveedor
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-gray-100" />
      ) : proveedores.length === 0 ? (
        <div className="mt-6 rounded-lg px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="font-display text-xl font-bold">Todavía no hay proveedores</p>
          <p className="mt-2 text-sm text-brand-muted">Agrega el primero para poder registrar compras.</p>
        </div>
      ) : (
        <DataTable className="mt-6" tableClassName="min-w-[640px]">
          <DataTableHead>
            <DataTableTh>Nombre</DataTableTh>
            <DataTableTh className="whitespace-nowrap">Crédito</DataTableTh>
            <DataTableTh numeric>Días</DataTableTh>
            <DataTableTh>Notas</DataTableTh>
            <DataTableTh className="w-24">
              <span className="sr-only">Editar</span>
            </DataTableTh>
          </DataTableHead>
          <tbody>
            {proveedores.map((proveedor) => (
              <DataTableRow key={proveedor.id}>
                <DataTableCell className="font-semibold">{proveedor.nombre}</DataTableCell>
                <DataTableCell className="whitespace-nowrap">{proveedor.tieneCredito ? "Sí" : "No"}</DataTableCell>
                <DataTableCell numeric>{proveedor.tieneCredito ? proveedor.diasCredito : "—"}</DataTableCell>
                <DataTableCell className="max-w-[280px] truncate text-brand-muted" title={proveedor.notas ?? undefined}>
                  {proveedor.notas || "—"}
                </DataTableCell>
                <DataTableCell>
                  <button
                    type="button"
                    onClick={() => setEditing(proveedor)}
                    className="text-sm font-bold"
                    style={{ color: brand.green }}
                  >
                    Editar
                  </button>
                </DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      )}

      {editing ? (
        <ProveedorModal
          proveedor={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (saved) => {
            setProveedores((current) => {
              const exists = current.some((item) => item.id === saved.id);
              const next = exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved];
              return [...next].sort((left, right) => left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" }));
            });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ProveedorModal({
  proveedor,
  onClose,
  onSaved,
}: {
  proveedor: Proveedor | null;
  onClose: () => void;
  onSaved: (proveedor: Proveedor) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(proveedor ? draftFrom(proveedor) : emptyDraft());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const nombreRef = useRef<HTMLInputElement | null>(null);
  const isNew = !proveedor;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => nombreRef.current?.focus());
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
      const payload = {
        nombre: draft.nombre.trim(),
        tieneCredito: draft.tieneCredito,
        diasCredito: draft.tieneCredito ? Number(draft.diasCredito || 0) : 0,
        notas: draft.notas.trim() || null,
      };
      const response = await fetch(isNew ? "/api/admin/proveedores" : `/api/admin/proveedores/${proveedor.id}`, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { proveedor?: Proveedor; error?: string } | null;
      if (!response.ok || !body?.proveedor) {
        throw new Error(body?.error || "No pudimos guardar");
      }
      await onSaved(body.proveedor);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "No pudimos guardar");
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
        aria-labelledby="proveedor-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Proveedores</p>
        <h2 id="proveedor-title" className="font-display mt-1 text-2xl font-bold">
          {isNew ? "Agregar proveedor" : "Editar proveedor"}
        </h2>

        <label className={`${adminLabelClass} mt-5`}>
          Nombre
          <AdminInput
            ref={nombreRef}
            required
            value={draft.nombre}
            onChange={(event) => setDraft((current) => ({ ...current, nombre: event.target.value }))}
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.tieneCredito}
            onChange={(event) => setDraft((current) => ({ ...current, tieneCredito: event.target.checked }))}
            className="h-4 w-4 accent-[#7EB341]"
          />
          Tiene crédito
        </label>

        <label className={`${adminLabelClass} mt-4`}>
          Días de crédito
          <AdminInput
            type="number"
            min={0}
            max={3650}
            inputMode="numeric"
            disabled={!draft.tieneCredito}
            value={draft.tieneCredito ? draft.diasCredito : ""}
            onChange={(event) => setDraft((current) => ({ ...current, diasCredito: event.target.value }))}
            placeholder={draft.tieneCredito ? "0" : "—"}
          />
        </label>

        <label className={`${adminLabelClass} mt-4`}>
          Notas
          <AdminTextarea
            value={draft.notas}
            onChange={(event) => setDraft((current) => ({ ...current, notas: event.target.value }))}
            rows={3}
          />
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
            disabled={saving || !draft.nombre.trim()}
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
