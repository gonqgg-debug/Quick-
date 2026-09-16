export function toMoney(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function parsePrice(raw: string): number | null {
  let value = raw.trim();
  if (!value) {
    return null;
  }
  value = value.replace(/rd\$|dop|usd/gi, "").replace(/\$/g, "").trim();
  value = value.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) {
    value = value.replace(/,/g, "");
  } else if (/^\d+,\d{1,2}$/.test(value)) {
    value = value.replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100) / 100;
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
