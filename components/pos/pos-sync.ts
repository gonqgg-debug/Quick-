"use client";

import { countPendingSales, posDb, readLocalProducts, replaceLocalCatalog, saveSaleAndStock, type PosSaleRecord } from "@/lib/pos-db";
import { saleTotal, type PosProduct } from "@/lib/pos-shared";

export type SyncStop = "ok" | "offline" | "unauthorized" | "error";

let syncing = false;

export async function queuePosSale(sale: Omit<PosSaleRecord, "status" | "lastError" | "total" | "cambio"> & { total?: number }): Promise<PosSaleRecord> {
  const total = saleTotal(sale.items);
  const cambio =
    sale.metodoPago === "efectivo" && sale.montoRecibido != null
      ? Math.round((sale.montoRecibido - total) * 100) / 100
      : null;
  const record: PosSaleRecord = {
    ...sale,
    total,
    cambio,
    status: "pendiente_sync",
    lastError: null,
  };
  await saveSaleAndStock(record);
  return record;
}

export async function syncPendingSales(): Promise<{ pending: number; stop: SyncStop }> {
  if (syncing || typeof navigator !== "undefined" && !navigator.onLine) {
    return { pending: await countPendingSales().catch(() => 0), stop: "offline" };
  }
  syncing = true;
  let stop: SyncStop = "ok";
  try {
    const pending = await posDb().sales.where("status").equals("pendiente_sync").sortBy("createdAt");
    for (const sale of pending) {
      try {
        const response = await fetch("/api/pos/venta", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: sale.clientId,
            metodoPago: sale.metodoPago,
            montoRecibido: sale.montoRecibido,
            items: sale.items.map((item) => ({
              productoId: item.productoId,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              precioLista: item.precioLista,
              descuento: item.descuento ?? 0,
            })),
            createdAt: sale.createdAt,
            descuentoTicket: sale.descuentoTicket ?? 0,
            descuentoTotal: sale.descuentoTotal ?? 0,
            quickcoins: sale.quickcoins
              ? {
                  telefono: sale.quickcoins.telefono,
                  nombre: sale.quickcoins.nombre,
                  canjePuntos: sale.quickcoins.canjePuntos,
                  ganarPuntos: sale.quickcoins.ganarPuntos,
                }
              : undefined,
          }),
        });
        if (response.status === 401) {
          stop = "unauthorized";
          await posDb().sales.update(sale.clientId, { lastError: "Hay que volver a entrar para sincronizar" });
          break;
        }
        if (!response.ok) {
          stop = "error";
          await posDb().sales.update(sale.clientId, { lastError: "Sigue en cola. Se reintenta sola." });
          break;
        }
        const body = (await response.json()) as { stockAdvertencia?: boolean };
        await posDb().sales.update(sale.clientId, {
          status: body.stockAdvertencia ? "sincronizada_advertencia" : "sincronizada",
          lastError: null,
        });
      } catch {
        stop = "offline";
        await posDb().sales.update(sale.clientId, { lastError: "Sin conexión" });
        break;
      }
    }
  } finally {
    syncing = false;
  }
  return { pending: await countPendingSales(), stop };
}

export async function pullCatalog(): Promise<{ products: PosProduct[]; unauthorized: boolean; offline: boolean; failed: boolean }> {
  const local = await readLocalProducts();
  try {
    const response = await fetch("/api/pos/productos", { credentials: "include", cache: "no-store" });
    if (response.status === 401) {
      return { products: local, unauthorized: true, offline: false, failed: false };
    }
    if (!response.ok) {
      return { products: local, unauthorized: false, offline: false, failed: true };
    }
    const body = (await response.json().catch(() => null)) as { products?: PosProduct[] } | null;
    if (!body || !Array.isArray(body.products)) {
      return { products: local, unauthorized: false, offline: true, failed: false };
    }
    const serverProducts = body.products;
    const merged = await replaceLocalCatalog(serverProducts);
    return { products: merged, unauthorized: false, offline: false, failed: false };
  } catch {
    return { products: local, unauthorized: false, offline: true, failed: false };
  }
}
