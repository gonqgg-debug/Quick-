function normalizeOptOutText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OPT_OUT_EXACT = new Set([
  "baja",
  "stop",
  "unsub",
  "unsubscribe",
  "parar",
  "no mas",
  "nomas",
  "no mas por favor",
  "cancelar suscripcion",
  "cancelar la suscripcion",
  "cancelar mi suscripcion",
  "dar de baja",
  "darme de baja",
  "no mas promociones",
  "no quiero promociones",
  "no quiero mas promociones",
  "no me escriban",
  "no me escribas",
  "no me escriban mas",
  "no me escribas mas",
  "quitarme de la lista",
  "fuera de la lista",
]);

const OPT_OUT_PREFIXES = [
  "cancelar suscripcion",
  "cancelar la suscripcion",
  "cancelar mi suscripcion",
  "dar de baja",
  "darme de baja",
  "no mas promociones",
  "unsubscribe",
];

export function isMarketingOptOutText(text: string): boolean {
  const normalized = normalizeOptOutText(text);
  if (!normalized) {
    return false;
  }
  if (OPT_OUT_EXACT.has(normalized)) {
    return true;
  }
  return OPT_OUT_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix} `));
}

export const MARKETING_OPT_OUT_REPLY =
  "Listo, no te vamos a enviar más promociones. Si en algún momento quieres pedidos, aquí seguimos";
