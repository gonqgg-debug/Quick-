import Dexie, { type Table } from "dexie";
import {
  pendingQtyByProduct,
  withOptimisticStock,
  type PosProduct,
  type PosSaleDraft,
  type PosStoredProduct,
} from "@/lib/pos";

class PosDatabase extends Dexie {
  products!: Table<PosStoredProduct, string>;
  sales!: Table<PosSaleDraft, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("quick-pos");
    this.version(1).stores({
      products: "id, nombre, categoria",
      sales: "clientId, status, createdAt",
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
