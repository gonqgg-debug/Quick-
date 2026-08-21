"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCustomerPhone } from "@/lib/customers";
import { formatCustomerOrderDate } from "@/lib/customer-orders-shared";
import {
  PRODUCT_REQUESTS_CHANGED_EVENT,
  productRequestEstadoLabel,
  type ProductRequest,
  type ProductRequestEstado,
} from "@/lib/product-requests-shared";
import { brand } from "@/lib/theme";

const FILTERS: Array<{ id: ProductRequestEstado | "todos"; label: string }> = [
  { id: "pendiente", label: "Pendientes" },
  { id: "agregado", label: "Agregados" },
  { id: "no_disponible", label: "No disponibles" },
  { id: "todos", label: "Todas" },
];

export function AdminProductRequests() {
  const router = useRouter();
  const [estado, setEstado] = useState<ProductRequestEstado | "todos">("pendiente");
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async (nextEstado: ProductRequestEstado | "todos") => {
    const response = await fetch(`/api/admin/catalogo/solicitudes?estado=${encodeURIComponent(nextEstado)}`, {
      credentials: "include",
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "No pudimos cargar las solicitudes");
    }
    const body = (await response.json()) as { requests: ProductRequest[]; pendingCount: number };
    setRequests(body.requests ?? []);
    setPendingCount(body.pendingCount ?? 0);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await load(estado);
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
  }, [estado, load]);

  async function resolve(id: string, next: Exclude<ProductRequestEstado, "pendiente">) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/catalogo/solicitudes/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: next, notaAdmin: notes[id]?.trim() || null }),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos actualizar la solicitud");
      }
      window.dispatchEvent(new Event(PRODUCT_REQUESTS_CHANGED_EVENT));
      await load(estado);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "No pudimos actualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Catálogo</p>
      <div className="mt-1">
        <h1 className="font-display text-2xl font-bold">Solicitudes de producto</h1>
        <p className="mt-1 max-w-xl text-sm text-brand-muted">
          Lo que los clientes no encontraron en el catálogo. Márcalas cuando las agregues o si no se pueden conseguir.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const active = estado === filter.id;
          const countLabel = filter.id === "pendiente" && pendingCount > 0 ? ` ${pendingCount}` : "";
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setEstado(filter.id)}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: active ? brand.green : "#F3F4F6",
                color: active ? "#FFFFFF" : brand.ink,
              }}
            >
              {filter.label}
              {countLabel}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-40 animate-pulse rounded-[24px] bg-gray-100" />
      ) : requests.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed px-5 py-10 text-center text-sm text-brand-muted" style={{ borderColor: `${brand.muted}40` }}>
          {estado === "pendiente" ? "No hay solicitudes pendientes." : "No hay solicitudes en este filtro."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {requests.map((item) => {
            const pending = item.estado === "pendiente";
            return (
              <li key={item.id} className="rounded-[24px] border bg-white p-4" style={{ borderColor: "#E5E7EB" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold leading-tight">{item.productoSolicitado}</p>
                    <p className="mt-1 text-sm text-brand-muted">
                      {item.clienteNombre || "Cliente"} · {formatCustomerPhone(item.phoneNumber)}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-muted">{formatCustomerOrderDate(item.createdAt)}</p>
                  </div>
                  <EstadoBadge estado={item.estado} />
                </div>
                {item.nota ? (
                  <p className="mt-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#F8FAF7" }}>
                    {item.nota}
                  </p>
                ) : null}
                {item.notaAdmin && !pending ? (
                  <p className="mt-2 text-sm text-brand-muted">Nota interna: {item.notaAdmin}</p>
                ) : null}
                {pending ? (
                  <div className="mt-4">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">Nota opcional</span>
                      <input
                        value={notes[item.id] ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="Ej. ya está en Almacén / no lo traemos"
                        className="mt-1.5 w-full rounded-2xl border bg-white px-3 py-2.5 text-sm outline-none"
                        style={{ borderColor: `${brand.muted}40` }}
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void resolve(item.id, "agregado")}
                        className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        style={{ backgroundColor: brand.green }}
                      >
                        Agregado
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void resolve(item.id, "no_disponible")}
                        className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50"
                        style={{ borderColor: `${brand.muted}40`, color: brand.ink }}
                      >
                        No disponible
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: ProductRequestEstado }) {
  const color =
    estado === "agregado" ? brand.green : estado === "no_disponible" ? brand.muted : brand.orange;
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: color }}
    >
      {productRequestEstadoLabel(estado)}
    </span>
  );
}
