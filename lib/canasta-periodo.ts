import { diffDayKeys, isDayKey } from "@/lib/local-day";
import { MilesError } from "@/lib/miles-domain";
import { CANASTA_MIN_ORDENES } from "@/lib/pos-domain";

export const CANASTA_PERIODO_MAX_DIAS = 184;

export function leerMinJuntos(raw: string | null): number {
  if (raw == null || raw.trim() === "") return CANASTA_MIN_ORDENES;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2 || n > 100) {
    throw new MilesError(400, "min tiene que ser un entero entre 2 y 100. Si se omite, el mínimo es 5 tickets juntos.");
  }
  return n;
}

export function afirmarPeriodoCanasta(desde: string, hasta: string): void {
  if (!isDayKey(desde) || !isDayKey(hasta) || desde > hasta) {
    throw new MilesError(400, "El periodo de la canasta tiene que ser YYYY-MM-DD, con desde anterior o igual a hasta");
  }
  if (diffDayKeys(desde, hasta) > CANASTA_PERIODO_MAX_DIAS - 1) {
    throw new MilesError(400, `La lista de complementarios admite hasta ${CANASTA_PERIODO_MAX_DIAS} días. Parte la ventana y recorre el cursor de cada una.`);
  }
}
