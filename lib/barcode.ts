export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function looksLikeBarcode(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length >= 8 && digits.length <= 14;
}

export function normalizeBarcode(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const digits = digitsOnly(value);
  return looksLikeBarcode(digits) ? digits : null;
}
