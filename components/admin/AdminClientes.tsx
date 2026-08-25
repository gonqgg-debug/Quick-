"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminClienteMarketing } from "@/components/admin/AdminClienteMarketing";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";
import type { AdminClienteListItem, AdminClienteSortKey } from "@/lib/admin-clientes-shared";
import { brand } from "@/lib/theme";

type SortDir = "asc" | "desc";

const COLUMNS: { key: AdminClienteSortKey; label: string; numeric?: boolean }[] = [
  { key: "nombre", label: "Nombre / Teléfono" },
  { key: "pedidosCount", label: "Pedidos", numeric: true },
  { key: "totalGastado", label: "Total histórico", numeric: true },
  { key: "ultimoPedidoAt", label: "Último pedido" },
  { key: "ticketPromedio", label: "Ticket promedio", numeric: true },
  { key: "aceptaMarketing", label: "Acepta marketing" },
];

function compareClientes(left: AdminClienteListItem, right: AdminClienteListItem, key: AdminClienteSortKey, dir: SortDir) {
  const factor = dir === "asc" ? 1 : -1;
  if (key === "nombre") {
    return factor * left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" });
  }
  if (key === "ultimoPedidoAt") {
    const a = left.ultimoPedidoAt ?? "";
    const b = right.ultimoPedidoAt ?? "";
    if (a === b) {
      return factor * left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" });
    }
    if (!a) {
      return 1;
    }
    if (!b) {
      return -1;
    }
    return factor * a.localeCompare(b);
  }
  if (key === "aceptaMarketing") {
    return factor * (Number(left.aceptaMarketing) - Number(right.aceptaMarketing));
  }
  return factor * (left[key] - right[key]);
}

export function AdminClientes() {
  const router = useRouter();
  const [clientes, setClientes] = useState<AdminClienteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<AdminClienteSortKey>("ultimoPedidoAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/clientes", { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as { clientes?: AdminClienteListItem[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar los clientes");
    }
    setClientes(body?.clientes ?? []);
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

  const visible = useMemo(() => {
    const filtered = query
      ? clientes.filter((cliente) => {
          const haystack = `${cliente.nombre} ${cliente.telefono} ${cliente.telefonoLabel}`.toLowerCase();
          return haystack.includes(query);
        })
      : clientes;
    return [...filtered].sort((left, right) => compareClientes(left, right, sortKey, sortDir));
  }, [clientes, query, sortKey, sortDir]);

  function toggleSort(key: AdminClienteSortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "nombre" ? "asc" : "desc");
  }

  async function toggleMarketing(cliente: AdminClienteListItem) {
    setTogglingId(cliente.chatId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/clientes/${cliente.chatId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceptaMarketing: !cliente.aceptaMarketing }),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as { cliente?: AdminClienteListItem; error?: string } | null;
      if (!response.ok || !body?.cliente) {
        throw new Error(body?.error || "No pudimos guardar el cambio");
      }
      setClientes((current) => current.map((item) => (item.chatId === body.cliente?.chatId ? body.cliente : item)));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "No pudimos guardar el cambio");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Clientes</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Directorio</h1>
      <p className="mt-1 text-sm text-brand-muted">Métricas derivadas de chats y pedidos. No hay una tabla aparte.</p>

      <input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder="Buscar por nombre o teléfono"
        className="mt-5 h-11 w-full max-w-md rounded-full border px-4 outline-none"
        style={{ borderColor: "#E5E7EB" }}
      />

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-gray-100" />
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-lg px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="font-display text-xl font-bold">{query ? "Sin resultados" : "Todavía no hay clientes"}</p>
          <p className="mt-2 text-sm text-brand-muted">
            {query ? "Prueba con otro nombre o teléfono." : "Cuando alguien escriba por WhatsApp, aparece aquí."}
          </p>
        </div>
      ) : (
        <DataTable className="mt-6" tableClassName="min-w-[920px]">
          <DataTableHead>
            {COLUMNS.map((column) => {
              const active = sortKey === column.key;
              return (
                <DataTableTh
                  key={column.key}
                  numeric={column.numeric}
                  aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="inline-flex items-center gap-1 uppercase tracking-wider"
                  >
                    {column.label}
                    <span className="text-[10px]" aria-hidden>
                      {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </DataTableTh>
              );
            })}
          </DataTableHead>
          <tbody>
            {visible.map((cliente) => (
              <DataTableRow
                key={cliente.chatId}
                onClick={() => router.push(`/admin/clientes/${cliente.chatId}`)}
              >
                <DataTableCell>
                  <Link
                    href={`/admin/clientes/${cliente.chatId}`}
                    className="font-semibold hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {cliente.nombre}
                  </Link>
                  <p className="text-xs text-brand-muted">{cliente.telefonoLabel}</p>
                </DataTableCell>
                <DataTableCell numeric>{cliente.pedidosCount}</DataTableCell>
                <DataTableCell numeric className="font-semibold">
                  {cliente.totalGastadoLabel}
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap">{cliente.ultimoPedidoLabel}</DataTableCell>
                <DataTableCell numeric>{cliente.ticketPromedioLabel}</DataTableCell>
                <DataTableCell>
                  <AdminClienteMarketing
                    acepta={cliente.aceptaMarketing}
                    disabled={togglingId === cliente.chatId}
                    onToggle={() => void toggleMarketing(cliente)}
                  />
                </DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
