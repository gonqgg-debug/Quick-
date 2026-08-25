"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminClienteMarketing } from "@/components/admin/AdminClienteMarketing";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";
import { PruebaBadge } from "@/components/order/PruebaBadge";
import type { AdminClienteDetalle } from "@/lib/admin-clientes-shared";
import { formatOrderNumber, orderStatusColor, orderStatusLabel } from "@/lib/order-display";
import { brand } from "@/lib/theme";

export function AdminClienteDetalle() {
  const params = useParams<{ chatId: string }>();
  const router = useRouter();
  const chatId = typeof params.chatId === "string" ? params.chatId : "";
  const [cliente, setCliente] = useState<AdminClienteDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/clientes/${encodeURIComponent(chatId)}`, { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as { cliente?: AdminClienteDetalle; error?: string } | null;
    if (response.status === 404) {
      setCliente(null);
      return;
    }
    if (!response.ok || !body?.cliente) {
      throw new Error(body?.error || "No pudimos cargar el cliente");
    }
    setCliente(body.cliente);
  }, [chatId, router]);

  useEffect(() => {
    if (!chatId) {
      setLoading(false);
      return;
    }
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
  }, [chatId, load]);

  async function toggleMarketing() {
    if (!cliente) {
      return;
    }
    setToggling(true);
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
      const body = (await response.json().catch(() => null)) as { cliente?: AdminClienteDetalle; error?: string } | null;
      if (!response.ok || !body?.cliente) {
        throw new Error(body?.error || "No pudimos guardar el cambio");
      }
      setCliente((current) =>
        current ? { ...current, aceptaMarketing: body.cliente.aceptaMarketing } : current
      );
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "No pudimos guardar el cambio");
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl h-48 animate-pulse rounded-lg bg-gray-100" />;
  }

  if (!cliente) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/clientes" className="text-sm font-bold" style={{ color: brand.green }}>
          ← Clientes
        </Link>
        <h1 className="font-display mt-4 text-2xl font-bold">No encontramos este cliente</h1>
        <p className="mt-2 text-sm text-brand-muted">Revisa el enlace o vuelve al directorio.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/clientes" className="text-sm font-bold" style={{ color: brand.green }}>
        ← Clientes
      </Link>

      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-brand-muted">Clientes</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{cliente.nombre}</h1>
          <p className="mt-1 text-sm text-brand-muted">{cliente.telefonoLabel}</p>
          <p className="mt-1 text-sm text-brand-muted">Cliente desde {cliente.clienteDesdeLabel}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-brand-muted">Acepta marketing</p>
          <AdminClienteMarketing acepta={cliente.aceptaMarketing} disabled={toggling} onToggle={() => void toggleMarketing()} />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Metric label="Pedidos" value={String(cliente.pedidosCount)} />
        <Metric label="Total histórico" value={cliente.totalGastadoLabel} />
        <Metric label="Ticket promedio" value={cliente.ticketPromedioLabel} />
        <Metric label="Último pedido" value={cliente.ultimoPedidoLabel} />
        <Metric label="Frecuencia de compra" value={cliente.frecuenciaCompraLabel} />
        <Metric label="Método de pago preferido" value={cliente.metodoPagoPreferidoLabel} />
      </div>

      <h2 className="font-display mt-8 text-xl font-bold">Productos favoritos</h2>
      {cliente.favoritos.length === 0 ? (
        <div className="mt-4 rounded-lg px-5 py-10 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="text-sm text-brand-muted">Todavía no hay productos de pedidos no cancelados.</p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cliente.favoritos.map((favorito) => (
            <li
              key={favorito.productId}
              className="rounded-lg border px-4 py-3"
              style={{ borderColor: "#E5E7EB" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-semibold leading-snug">{favorito.nombre}</p>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: `${brand.green}22`, color: brand.green }}
                >
                  Pedido {favorito.veces} {favorito.veces === 1 ? "vez" : "veces"}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-brand-muted">
                Cantidad total: {favorito.cantidadTotal}
                {favorito.ultimoPedidoLabel !== "—" ? ` · Último: ${favorito.ultimoPedidoLabel}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="font-display mt-8 text-xl font-bold">Historial de pedidos</h2>
      {cliente.pedidos.length === 0 ? (
        <div className="mt-4 rounded-lg px-5 py-10 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="text-sm text-brand-muted">Este chat todavía no tiene pedidos.</p>
        </div>
      ) : (
        <DataTable className="mt-4" tableClassName="min-w-[560px]">
          <DataTableHead>
            <DataTableTh>Fecha</DataTableTh>
            <DataTableTh>Pedido</DataTableTh>
            <DataTableTh>Estado</DataTableTh>
            <DataTableTh numeric>Total</DataTableTh>
          </DataTableHead>
          <tbody>
            {cliente.pedidos.map((pedido) => (
              <DataTableRow key={pedido.id}>
                <DataTableCell className="whitespace-nowrap">{pedido.createdAtLabel}</DataTableCell>
                <DataTableCell className="font-semibold">
                  #{formatOrderNumber(pedido.id)}
                  {pedido.esPrueba ? (
                    <span className="ml-2 inline-flex align-middle">
                      <PruebaBadge />
                    </span>
                  ) : null}
                </DataTableCell>
                <DataTableCell>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: orderStatusColor(pedido.estado) }}
                  >
                    {orderStatusLabel(pedido.estado)}
                  </span>
                </DataTableCell>
                <DataTableCell numeric className="font-semibold">
                  {pedido.totalLabel}
                </DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "#E5E7EB" }}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
