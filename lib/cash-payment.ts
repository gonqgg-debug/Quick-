import { formatPrice, toMoney } from "@/lib/money";

export const DOP_CASH_BILLS = [50, 100, 200, 500, 1000, 2000] as const;

export function coversTotal(pagoCon: number, total: number): boolean {
  return toMoney(pagoCon) + 0.001 >= toMoney(total);
}

export function suggestedPagoConAmounts(total: number): number[] {
  const need = Math.ceil(toMoney(total));
  if (!(need > 0)) {
    return [];
  }
  const amounts = new Set<number>([need]);
  for (const bill of DOP_CASH_BILLS) {
    if (bill >= need) {
      amounts.add(bill);
    }
  }
  return Array.from(amounts).sort((a, b) => a - b).slice(0, 6);
}

export function cashChange(pagoCon: number | null | undefined, total: number): number | null {
  if (pagoCon == null) {
    return null;
  }
  const amount = toMoney(pagoCon);
  if (!(amount > 0)) {
    return null;
  }
  const change = amount - toMoney(total);
  return change > 0.001 ? toMoney(change) : 0;
}

export function parsePagoConAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return toMoney(amount);
}

export function paymentMethodLabel(
  metodoPago: string,
  pagoCon?: number | null,
  total?: number | null
): string {
  if (metodoPago === "tarjeta") {
    return "Tarjeta";
  }
  if (metodoPago !== "efectivo") {
    return metodoPago || "—";
  }
  const amount = pagoCon == null ? 0 : toMoney(pagoCon);
  if (!(amount > 0)) {
    return "Efectivo";
  }
  const change = cashChange(amount, total ?? 0);
  if (change == null || change <= 0) {
    return `Efectivo · pago exacto (${formatPrice(amount)})`;
  }
  return `Efectivo · paga con ${formatPrice(amount)} · cambio ${formatPrice(change)}`;
}
