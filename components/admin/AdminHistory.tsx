"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OrderSnapshot } from "@/components/staff/OrderSnapshot";
import { PruebaBadge } from "@/components/order/PruebaBadge";
import { formatOrderNumber, orderStatusLabel } from "@/lib/order-display";
import { feedbackEmoji } from "@/lib/order-feedback";
import {
  HISTORY_PAGE_SIZE,
  HISTORY_STATES,
  formatHistoryDateTime,
  historyQueryString,
  type HistoryEstado,
  type HistoryOrder,
} from "@/lib/staff-history-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_FILTERS: { id: "todos" | "atencion" | HistoryEstado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "atencion", label: "Requieren atención" },
  { id: "completada", label: "Completada" },
  { id: "cancelada", label: "Cancelada" },
  { id: "despachada", label: "Despachada" },
];

function statusBadge(estado: HistoryEstado): "default" | "secondary" | "destructive" {
  if (estado === "cancelada") return "destructive";
  if (estado === "despachada") return "secondary";
  return "default";
}

export function AdminHistory() {
  const router = useRouter();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [estado, setEstado] = useState<"todos" | "atencion" | HistoryEstado>("todos");
  const [includePruebas, setIncludePruebas] = useState(false);
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filterParams = useMemo(() => {
    const estados =
      estado === "todos" || estado === "atencion" ? Array.from(HISTORY_STATES) : [estado];
    const min = minTotal.trim() === "" ? null : Number(minTotal);
    const max = maxTotal.trim() === "" ? null : Number(maxTotal);
    return {
      q: query,
      from: from || null,
      to: to || null,
      estados,
      minTotal: Number.isFinite(min) ? min : null,
      maxTotal: Number.isFinite(max) ? max : null,
      includePruebas,
      requiereAtencion: estado === "atencion",
    };
  }, [query, from, to, estado, minTotal, maxTotal, includePruebas]);

  const queryString = useMemo(() => historyQueryString({ ...filterParams, page }), [filterParams, page]);

  useEffect(() => {
    setExpandedId(null);
  }, [queryString]);

  const loadHistory = useCallback(async (): Promise<boolean> => {
    const response = await fetch(`/api/admin/orders/history?${queryString}`, { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return false;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "No pudimos cargar el historial");
    }
    const body = (await response.json()) as { orders: HistoryOrder[]; total: number };
    setOrders(body.orders ?? []);
    setTotal(body.total ?? 0);
    return true;
  }, [queryString, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const ok = await loadHistory();
        if (ok && !cancelled) {
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
  }, [loadHistory]);

  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const fromRow = total === 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE + 1;
  const toRow = Math.min(page * HISTORY_PAGE_SIZE, total);

  async function exportExcel() {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/history/export?${historyQueryString(filterParams)}`, {
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos exportar");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `historial-pedidos-${stamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Delivery</p>
            <h1 className="font-display text-2xl font-bold">Historial de Delivery</h1>
          </div>
          <Button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || total === 0}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {exporting ? "Exportando..." : "Exportar a Excel"}
          </Button>
        </div>

        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar por # orden, cliente o teléfono"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-medium text-foreground">
            Desde
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Hasta
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Monto mín.
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={minTotal}
              onChange={(event) => {
                setMinTotal(event.target.value);
                setPage(1);
              }}
              placeholder="Opcional"
              className="mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Monto máx.
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={maxTotal}
              onChange={(event) => {
                setMaxTotal(event.target.value);
                setPage(1);
              }}
              placeholder="Opcional"
              className="mt-1.5"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          {STATUS_FILTERS.map((filter) => {
            const active = estado === filter.id;
            return (
              <Button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                size="sm"
                variant={active ? (filter.id === "atencion" ? "destructive" : "default") : "secondary"}
                onClick={() => {
                  setEstado(filter.id);
                  setPage(1);
                }}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>

        <label className="flex items-start gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={includePruebas}
            onChange={(event) => {
              setIncludePruebas(event.target.checked);
              setPage(1);
            }}
            className="mt-0.5 h-4 w-4 accent-[#7EB341]"
          />
          <span>
            Incluir pedidos de prueba
            <span className="block text-xs font-medium text-brand-muted">
              Por defecto quedan fuera de la lista, las métricas y la exportación.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6">
        {error ? (
          <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : orders.length === 0 ? (
          <Card className="px-5 py-14 text-center shadow-sm">
            <p className="text-4xl">🌿</p>
            <p className="font-display mt-3 text-xl font-bold">No hay pedidos con esos filtros</p>
            <p className="mt-2 text-sm text-muted-foreground">Prueba otro rango de fechas, estado o búsqueda.</p>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden shadow-sm">
              <Table className="min-w-[1020px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead># Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead className="text-right"># Ítems</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Calificación</TableHead>
                    <TableHead>Tiempo que tardó</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Detalle</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const open = expandedId === order.id;
                    return (
                      <HistoryRow
                        key={order.id}
                        order={order}
                        open={open}
                        onToggle={() => setExpandedId(open ? null : order.id)}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {fromRow}–{toRow} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Anterior
                </Button>
                <p className="text-sm font-medium tabular-nums">
                  {page} / {pageCount}
                </p>
                <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryRow({
  order,
  open,
  onToggle,
}: {
  order: HistoryOrder;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        className={
          order.feedback?.requiereAtencion && !open
            ? "cursor-pointer bg-destructive/5 hover:bg-destructive/10"
            : "cursor-pointer"
        }
        data-state={open ? "selected" : undefined}
        onClick={onToggle}
      >
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
          {formatHistoryDateTime(order.createdAt)}
        </TableCell>
        <TableCell className="whitespace-nowrap font-medium">
          <span className="inline-flex items-center gap-1.5">
            #{formatOrderNumber(order.id)}
            {order.esPrueba ? <PruebaBadge /> : null}
            {order.feedback?.requiereAtencion ? <Badge variant="destructive">Atención</Badge> : null}
          </span>
        </TableCell>
        <TableCell className="max-w-[140px] truncate">{order.clienteNombre || "—"}</TableCell>
        <TableCell className="whitespace-nowrap">{order.clienteTelefono}</TableCell>
        <TableCell className="max-w-[220px] truncate" title={order.direccion}>
          {order.direccion}
        </TableCell>
        <TableCell className="text-right tabular-nums">{order.itemCount}</TableCell>
        <TableCell className="text-right font-medium">{order.totalLabel}</TableCell>
        <TableCell>
          <Badge variant={statusBadge(order.estado)}>{orderStatusLabel(order.estado)}</Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {order.feedback ? (
            <span
              className={`inline-flex items-center gap-1 text-sm font-medium ${
                order.feedback.requiereAtencion ? "text-destructive" : "text-primary"
              }`}
            >
              <span aria-hidden>{feedbackEmoji(order.feedback.calificacion)}</span>
              {order.feedback.calificacion}/5
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap font-mono text-sm tabular-nums text-muted-foreground">
          {order.durationLabel}
        </TableCell>
        <TableCell>
          <span className="flex h-8 w-8 items-center justify-center text-muted-foreground" aria-hidden>
            <ChevronIcon open={open} />
          </span>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={11} className="pb-4 pt-1">
            {order.feedback ? (
              <div
                className={`mb-3 rounded-lg px-4 py-3 ${
                  order.feedback.requiereAtencion ? "bg-destructive/10" : "bg-muted"
                }`}
              >
                <p className={`text-sm font-semibold ${order.feedback.requiereAtencion ? "text-destructive" : "text-foreground"}`}>
                  {feedbackEmoji(order.feedback.calificacion)} {order.feedback.calificacion}/5
                  {order.feedback.requiereAtencion ? " · Requiere atención" : ""}
                </p>
                {order.feedback.comentario ? (
                  <p className="mt-1 text-sm text-foreground">“{order.feedback.comentario}”</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Sin comentario</p>
                )}
              </div>
            ) : null}
            <OrderSnapshot
              direccion={order.direccion}
              metodoPago={order.metodoPago}
              clienteTelefono={order.clienteTelefono}
              items={order.items}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      style={{ transform: open ? "rotate(180deg)" : undefined }}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
