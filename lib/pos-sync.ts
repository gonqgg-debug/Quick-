import { countPendingSales, markSaleAttempt, markSaleSynced, oldestPendingSale, saveServerCatalog } from "@/lib/pos-db";
import { toMoney } from "@/lib/money";
import type { PosStoredProduct } from "@/lib/pos";

export type CatalogRefreshResult = "ok" | "unauthorized" | "offline" | "error";

export type SyncResult = {
  pending: number;
  synced: number;
  needsLogin: boolean;
  lastError: string | null;
};

type ProductPayload = {
  id?: unknown;
  nombre?: unknown;
  marca?: unknown;
  precio?: unknown;
  fotoUrl?: unknown;
  foto_url?: unknown;
  categoria?: unknown;
  stock?: unknown;
};

function mapStored(row: ProductPayload): PosStoredProduct | null {
  const id = typeof row.id === "string" ? row.id : "";
  const nombre = typeof row.nombre === "string" ? row.nombre.trim() : "";
  if (!id || !nombre) {
    return null;
  }
  const marca = typeof row.marca === "string" && row.marca.trim() ? row.marca.trim() : null;
  const fotoRaw = row.fotoUrl ?? row.foto_url;
  const fotoUrl = typeof fotoRaw === "string" && fotoRaw.trim() ? fotoRaw.trim() : null;
  const categoria = typeof row.categoria === "string" ? row.categoria : "";
  let stockBase: number | null = null;
  if (row.stock != null && row.stock !== "") {
    const stock = typeof row.stock === "number" ? row.stock : Number(row.stock);
    if (Number.isFinite(stock)) {
      stockBase = Math.trunc(stock);
    }
  }
  return {
    id,
    nombre,
    marca,
    precio: toMoney(row.precio),
    fotoUrl,
    categoria,
    stockBase,
  };
}

export async function refreshCatalogFromNetwork(): Promise<CatalogRefreshResult> {
  let response: Response;
  try {
    response = await fetch("/api/pos/productos", {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return "offline";
  }
  if (response.status === 401) {
    return "unauthorized";
  }
  if (!response.ok) {
    return "error";
  }
  const body = (await response.json().catch(() => null)) as { products?: ProductPayload[] } | null;
  const rows = (body?.products ?? []).map(mapStored).filter((row): row is PosStoredProduct => Boolean(row));
  await saveServerCatalog(rows);
  return "ok";
}

let syncing = false;

export async function syncPendingSales(): Promise<SyncResult> {
  if (syncing || (typeof navigator !== "undefined" && !navigator.onLine)) {
    const pending = await countPendingSales().catch(() => 0);
    return { pending, synced: 0, needsLogin: false, lastError: null };
  }
  syncing = true;
  let synced = 0;
  let needsLogin = false;
  let lastError: string | null = null;
  try {
    for (;;) {
      const sale = await oldestPendingSale();
      if (!sale) {
        break;
      }
      let response: Response;
      try {
        response = await fetch("/api/pos/venta", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: sale.clientId,
            fecha: sale.createdAt,
            metodo_pago: sale.metodoPago,
            monto_recibido: sale.montoRecibido,
            items: sale.items.map((item) => ({
              producto_id: item.productoId,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precio_unitario: item.precioUnitario,
            })),
          }),
        });
      } catch {
        lastError = "Sin conexión";
        await markSaleAttempt(sale.clientId, lastError);
        break;
      }
      if (response.status === 401) {
        needsLogin = true;
        lastError = "Sesión vencida";
        await markSaleAttempt(sale.clientId, lastError);
        break;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        lastError = body?.error || `Error ${response.status}`;
        await markSaleAttempt(sale.clientId, lastError);
        break;
      }
      const body = (await response.json().catch(() => null)) as { stockAdvertencia?: boolean } | null;
      await markSaleSynced(sale.clientId, Boolean(body?.stockAdvertencia));
      synced += 1;
    }
  } finally {
    syncing = false;
  }
  const pending = await countPendingSales().catch(() => 0);
  return { pending, synced, needsLogin, lastError };
}
