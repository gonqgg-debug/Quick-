import {
  countPendingPosWork,
  markSaleAttempt,
  markSaleSynced,
  markShiftAttempt,
  markShiftCloseSynced,
  markShiftOpenSynced,
  oldestPendingSale,
  pendingCloseShifts,
  pendingOpenShifts,
  saveServerCatalog,
} from "@/lib/pos-db";
import { toMoney } from "@/lib/money";
import type { PosShiftRecord, PosStoredProduct } from "@/lib/pos";

export type CatalogRefreshResult =
  | { status: "ok" }
  | { status: "unauthorized" }
  | { status: "offline" }
  | { status: "error"; message: string };

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
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return { status: "offline" };
  }
  if (response.status === 401) {
    return { status: "unauthorized" };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { status: "error", message: body?.error || "No pudimos cargar el catálogo" };
  }
  const body = (await response.json().catch(() => null)) as { products?: ProductPayload[] } | null;
  const rows = (body?.products ?? []).map(mapStored).filter((row): row is PosStoredProduct => Boolean(row));
  await saveServerCatalog(rows);
  return { status: "ok" };
}

let syncing = false;

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || `Error ${response.status}`;
}

async function postJson(url: string, payload: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function syncOpenShift(shift: PosShiftRecord): Promise<"ok" | "login" | "stop"> {
  let response: Response;
  try {
    response = await postJson("/api/pos/turno", {
      client_id: shift.clientId,
      abierto_en: shift.abiertoEn,
      fondo_inicial: shift.fondoInicial,
      abierto_por: shift.abiertoPor,
    });
  } catch {
    await markShiftAttempt(shift.clientId, "Sin conexión");
    return "stop";
  }
  if (response.status === 401) {
    await markShiftAttempt(shift.clientId, "Sesión vencida");
    return "login";
  }
  if (!response.ok) {
    await markShiftAttempt(shift.clientId, await readError(response));
    return "stop";
  }
  await markShiftOpenSynced(shift.clientId);
  return "ok";
}

async function syncCloseShift(shift: PosShiftRecord): Promise<"ok" | "login" | "stop"> {
  let response: Response;
  try {
    response = await postJson("/api/pos/turno/cierre", {
      client_id: shift.clientId,
      cerrado_en: shift.cerradoEn,
      efectivo_contado: shift.efectivoContado,
      notas: shift.notas,
      ventas_count: shift.ventasAlCierre ?? 0,
    });
  } catch {
    await markShiftAttempt(shift.clientId, "Sin conexión");
    return "stop";
  }
  if (response.status === 401) {
    await markShiftAttempt(shift.clientId, "Sesión vencida");
    return "login";
  }
  if (!response.ok) {
    await markShiftAttempt(shift.clientId, await readError(response));
    return "stop";
  }
  await markShiftCloseSynced(shift.clientId);
  return "ok";
}

export async function syncPendingSales(): Promise<SyncResult> {
  if (syncing || (typeof navigator !== "undefined" && !navigator.onLine)) {
    const pending = await countPendingPosWork().catch(() => 0);
    return { pending, synced: 0, needsLogin: false, lastError: null };
  }
  syncing = true;
  let synced = 0;
  let needsLogin = false;
  let lastError: string | null = null;
  try {
    const opens = await pendingOpenShifts();
    for (const shift of opens) {
      const result = await syncOpenShift(shift);
      if (result === "login") {
        needsLogin = true;
        lastError = "Sesión vencida";
        break;
      }
      if (result === "stop") {
        lastError = "No pudimos subir la apertura del turno";
        break;
      }
      synced += 1;
    }
    if (!needsLogin && !lastError) {
      for (;;) {
        const sale = await oldestPendingSale();
        if (!sale) {
          break;
        }
        let response: Response;
        try {
          response = await postJson("/api/pos/venta", {
            client_id: sale.clientId,
            fecha: sale.createdAt,
            metodo_pago: sale.metodoPago,
            monto_recibido: sale.montoRecibido,
            turno_client_id: sale.turnoClientId ?? null,
            creado_por: sale.cajero ?? null,
            items: sale.items.map((item) => ({
              producto_id: item.productoId,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precio_unitario: item.precioUnitario,
            })),
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
          lastError = await readError(response);
          await markSaleAttempt(sale.clientId, lastError);
          break;
        }
        const body = (await response.json().catch(() => null)) as { stockAdvertencia?: boolean } | null;
        await markSaleSynced(sale.clientId, Boolean(body?.stockAdvertencia));
        synced += 1;
      }
    }
    if (!needsLogin && !lastError) {
      const closes = await pendingCloseShifts();
      for (const shift of closes) {
        const result = await syncCloseShift(shift);
        if (result === "login") {
          needsLogin = true;
          lastError = "Sesión vencida";
          break;
        }
        if (result === "stop") {
          lastError = "Faltan ventas por sincronizar";
          break;
        }
        synced += 1;
      }
    }
  } finally {
    syncing = false;
  }
  const pending = await countPendingPosWork().catch(() => 0);
  return { pending, synced, needsLogin, lastError };
}
