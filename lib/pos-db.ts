import Dexie, { type Table } from "dexie";
import { mergeStock, type PosProduct, type PosSaleItem, type PosSaleStatus, type PosMetodoPago } from "@/lib/pos-shared";
import type { CajaTurnoPeriodo } from "@/lib/admin-caja-shared";

export type PosShift = {
  id: "current";
  periodo: CajaTurnoPeriodo;
  fondoInicial: number;
  openedAt: string;
};

export type PosSaleRecord = {
  clientId: string;
  createdAt: string;
  items: PosSaleItem[];
  metodoPago: PosMetodoPago;
  montoRecibido: number | null;
  cambio: number | null;
  total: number;
  status: PosSaleStatus;
  lastError: string | null;
};

class PosDatabase extends Dexie {
  products!: Table<PosProduct, string>;
  sales!: Table<PosSaleRecord, string>;
  shift!: Table<PosShift, string>;

  constructor() {
    super("quick-pos");
    this.version(1).stores({
      products: "id, categoria, nombre",
      sales: "clientId, status, createdAt",
    });
    this.version(2).stores({
      shift: "id",
    });
  }
}

let database: PosDatabase | null = null;

export function posDb(): PosDatabase {
  if (!database) {
    database = new PosDatabase();
  }
  return database;
}

export async function readLocalProducts(): Promise<PosProduct[]> {
  const rows = await posDb().products.toArray();
  return rows.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function pendingQtyByProduct(): Promise<Map<string, number>> {
  const pending = await posDb().sales.where("status").equals("pendiente_sync").toArray();
  const totals = new Map<string, number>();
  for (const sale of pending) {
    for (const item of sale.items) {
      totals.set(item.productoId, (totals.get(item.productoId) ?? 0) + item.cantidad);
    }
  }
  return totals;
}

export async function replaceLocalCatalog(serverProducts: PosProduct[]): Promise<PosProduct[]> {
  const pending = await pendingQtyByProduct();
  const merged = serverProducts.map((product) => ({
    ...product,
    stock: mergeStock(product.stock, pending.get(product.id) ?? 0),
  }));
  await posDb().transaction("rw", posDb().products, async () => {
    await posDb().products.clear();
    await posDb().products.bulkPut(merged);
  });
  return merged;
}

export async function saveSaleAndStock(sale: PosSaleRecord): Promise<void> {
  const db = posDb();
  await db.transaction("rw", db.sales, db.products, async () => {
    await db.sales.put(sale);
    for (const item of sale.items) {
      const product = await db.products.get(item.productoId);
      if (!product || product.stock == null) {
        continue;
      }
      await db.products.update(item.productoId, { stock: product.stock - item.cantidad });
    }
  });
}

export async function countPendingSales(): Promise<number> {
  return posDb().sales.where("status").equals("pendiente_sync").count();
}

export async function readShift(): Promise<PosShift | null> {
  return (await posDb().shift.get("current")) ?? null;
}

export async function saveShift(shift: PosShift): Promise<void> {
  await posDb().shift.put(shift);
}

export async function clearShift(): Promise<void> {
  await posDb().shift.delete("current");
}

export async function salesSince(openedAt: string): Promise<{ count: number; total: number }> {
  const rows = await posDb().sales.where("createdAt").aboveOrEqual(openedAt).toArray();
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return { count: rows.length, total: Math.round(total * 100) / 100 };
}
