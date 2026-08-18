export function toMoney(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatPrice(value: unknown): string {
  const amount = toMoney(value);
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `RD$${formatted}`;
}
