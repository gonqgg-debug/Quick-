import Dexie, { type Table } from "dexie";
import {
  pendingQtyByProduct,
  withOptimisticStock,
  type PosProduct,
  type PosSaleDraft,
  type PosShiftRecord,
  type PosStoredProduct,
} from "@/lib/pos";

class PosDatabase extends Dexie {
  products!: Table<PosStoredProduct, string>;
  sales!: Table<PosSaleDraft, string>;
  shifts!: Table<PosShiftRecord, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("quick-pos");
    this.version(1).stores({
      products: "id, nombre, categoria",
      sales: "clientId, status, createdAt",
      meta: "key",
    });
    this.version(2).stores({
      products: "id, nombre, categoria",
      sales: "clientId, status, createdAt, turnoClientId",
      shifts: "clientId, estado, abiertoEn",
      meta: "key",
    });
    this.version(3).stores({
      products: "id, nombre, categoria, codigoBarras",
      sales: "clientId, status, createdAt, turnoClientId",
      shifts: "clientId, estado, abiertoEn",
      meta: "key",
    });
  }
}

let database: PosDatabase | null = null;
let chain: Promise<void> = Promise.resolve();

export function getPosDb(): PosDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB no está disponible");
  }
  if (!database) {
    database = new PosDatabase();
  }
  return database;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readCatalogUnlocked(): Promise<PosProduct[]> {
  const db = getPosDb();
  const [products, pending] = await Promise.all([
    db.products.orderBy("nombre").toArray(),
    db.sales.where("status").equals("pendiente_sync").toArray(),
  ]);
  return withOptimisticStock(products, pendingQtyByProduct(pending)).sort((left, right) =>
    left.nombre.localeCompare(right.nombre, "es")
  );
}

export function readPosCatalog(): Promise<PosProduct[]> {
  return enqueue(() => readCatalogUnlocked());
}

export function countPendingSales(): Promise<number> {
  return getPosDb().sales.where("status").equals("pendiente_sync").count();
}

export async function countPendingPosWork(): Promise<number> {
  const db = getPosDb();
  const [sales, shifts] = await Promise.all([
    db.sales.where("status").equals("pendiente_sync").count(),
    db.shifts.toArray(),
  ]);
  const shiftOps = shifts.reduce((sum, shift) => {
    return (
      sum +
      (shift.aperturaSync === "pendiente_sync" ? 1 : 0) +
      (shift.cierreSync === "pendiente_sync" ? 1 : 0)
    );
  }, 0);
  return sales + shiftOps;
}

export function readOpenShift(): Promise<PosShiftRecord | null> {
  return enqueue(async () => {
    const rows = await getPosDb().shifts.where("estado").equals("abierto").sortBy("abiertoEn");
    return rows[rows.length - 1] ?? null;
  });
}

export function readShiftSales(turnoClientId: string): Promise<PosSaleDraft[]> {
  return enqueue(async () => getPosDb().sales.where("turnoClientId").equals(turnoClientId).sortBy("createdAt"));
}

export function saveLocalShift(shift: PosShiftRecord): Promise<void> {
  return enqueue(async () => {
    await getPosDb().shifts.put(shift);
  });
}

export function pendingOpenShifts(): Promise<PosShiftRecord[]> {
  return enqueue(async () => {
    const rows = await getPosDb().shifts.toArray();
    return rows
      .filter((row) => row.aperturaSync === "pendiente_sync")
      .sort((left, right) => left.abiertoEn.localeCompare(right.abiertoEn));
  });
}

export function pendingCloseShifts(): Promise<PosShiftRecord[]> {
  return enqueue(async () => {
    const rows = await getPosDb().shifts.toArray();
    return rows
      .filter((row) => row.cierreSync === "pendiente_sync")
      .sort((left, right) => (left.cerradoEn ?? "").localeCompare(right.cerradoEn ?? ""));
  });
}

export function markShiftOpenSynced(clientId: string): Promise<void> {
  return enqueue(async () => {
    await getPosDb().shifts.update(clientId, { aperturaSync: "sincronizada", lastError: null });
  });
}

export function markShiftCloseSynced(clientId: string): Promise<void> {
  return enqueue(async () => {
    await getPosDb().shifts.update(clientId, { cierreSync: "sincronizada", lastError: null });
  });
}

export function markShiftAttempt(clientId: string, lastError: string): Promise<void> {
  return enqueue(async () => {
    await getPosDb().shifts.update(clientId, { lastError: lastError.slice(0, 300) });
  });
}

export function readCatalogFetchedAt(): Promise<string | null> {
  return getPosDb()
    .meta.get("catalogFetchedAt")
    .then((row) => row?.value ?? null);
}

export function saveServerCatalog(rows: PosStoredProduct[]): Promise<PosProduct[]> {
  return enqueue(async () => {
    const db = getPosDb();
    await db.transaction("rw", db.products, db.meta, async () => {
      await db.products.clear();
      if (rows.length > 0) {
        await db.products.bulkAdd(rows);
      }
      await db.meta.put({ key: "catalogFetchedAt", value: new Date().toISOString() });
    });
    return readCatalogUnlocked();
  });
}

export function saveLocalSale(sale: PosSaleDraft): Promise<PosProduct[]> {
  return enqueue(async () => {
    const db = getPosDb();
    const existing = await db.sales.get(sale.clientId);
    if (!existing) {
      await db.sales.add(sale);
    }
    return readCatalogUnlocked();
  });
}

export function oldestPendingSale(): Promise<PosSaleDraft | null> {
  return enqueue(async () => {
    const rows = await getPosDb().sales.where("status").equals("pendiente_sync").sortBy("createdAt");
    return rows[0] ?? null;
  });
}

export function markSaleCoins(clientId: string, coinsSync: "sincronizada" | "no_aplica"): Promise<void> {
  return enqueue(async () => {
    const current = await getPosDb().sales.get(clientId);
    if (!current?.quickcoins) return;
    await getPosDb().sales.update(clientId, {
      quickcoins: { ...current.quickcoins, coinsSync },
    });
  });
}

export function markSaleSynced(clientId: string, stockAdvertencia: boolean): Promise<void> {
  return enqueue(async () => {
    await getPosDb().sales.update(clientId, {
      status: "sincronizada",
      stockAdvertencia,
      lastError: null,
    });
  });
}

export function markSaleAttempt(clientId: string, lastError: string): Promise<void> {
  return enqueue(async () => {
    const db = getPosDb();
    const current = await db.sales.get(clientId);
    if (!current || current.status !== "pendiente_sync") {
      return;
    }
    await db.sales.update(clientId, {
      attempts: current.attempts + 1,
      lastError: lastError.slice(0, 300),
    });
  });
}
