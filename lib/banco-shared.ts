import { addDaysToDayKey, diffDayKeys } from "@/lib/local-day";
import { parsePrice } from "@/lib/money";

export type BancoTipo = "debito" | "credito";

export type BancoMovimientoEntrada = {
  fecha: string;
  descripcion: string | null;
  referencia: string | null;
  tipo: BancoTipo;
  monto: number;
};

export type BancoMovimiento = BancoMovimientoEntrada & {
  id: string;
  banco: string;
  cuenta: string | null;
  moneda: "DOP" | "USD";
  importadoPor: string;
  importadoEn: string;
  /** Factura que paga, si ya se ligó. */
  factura: { id: string; referencia: string } | null;
};

export type BancoColumnas = {
  fecha: number;
  descripcion: number | null;
  referencia: number | null;
  debito: number | null;
  credito: number | null;
  monto: number | null;
  tipo: number | null;
};

export type EstadoCuentaLeido = {
  columnas: BancoColumnas;
  encabezados: string[];
  movimientos: BancoMovimientoEntrada[];
  /** Filas debajo del encabezado sin fecha o sin monto (saldos, totales, líneas en blanco). */
  descartadas: number;
};

/** Un banco puede pagarse días después de la factura; se busca desde la emisión hasta 7 días después del vencimiento. */
export const BANCO_DIAS_DESPUES = 7;

function normal(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const REGLAS: Array<{ campo: keyof BancoColumnas; prueba: RegExp }> = [
  { campo: "fecha", prueba: /^(fecha( de)?( (transaccion|operacion|movimiento|posteo|efectiva))?|date|posting date|transaction date)$/ },
  { campo: "debito", prueba: /^(monto )?(debitos?|retiros?|cargos?|debits?|withdrawals?)\b/ },
  { campo: "credito", prueba: /^(monto )?(creditos?|depositos?|abonos?|credits?|deposits?)\b/ },
  { campo: "monto", prueba: /^(monto|importe|valor|amount)( (rd\$|dop|usd))?$/ },
  { campo: "tipo", prueba: /^(tipo|d\/c|db\/cr|dr\/cr|tipo de transaccion|tipo movimiento)$/ },
  { campo: "referencia", prueba: /(referencia|^ref\b|^no\.?( de)? (documento|referencia|cheque)|^numero|^documento|^cheque|serial)/ },
  { campo: "descripcion", prueba: /(descripcion|concepto|detalle|narrativa|description|memo|transaccion|beneficiario)/ },
];

/** Busca el encabezado en las primeras 20 filas: la que tenga fecha y algún monto. */
export function detectarColumnas(filas: string[][]): { fila: number; columnas: BancoColumnas } | null {
  for (let indice = 0; indice < Math.min(filas.length, 20); indice += 1) {
    const celdas = filas[indice].map(normal);
    const columnas: BancoColumnas = { fecha: -1, descripcion: null, referencia: null, debito: null, credito: null, monto: null, tipo: null };
    celdas.forEach((celda, columna) => {
      if (!celda || /^(saldo|balance)/.test(celda)) {
        return;
      }
      const regla = REGLAS.find((item) => item.prueba.test(celda) && (item.campo === "fecha" ? columnas.fecha < 0 : columnas[item.campo] == null));
      if (!regla) {
        return;
      }
      if (regla.campo === "fecha") {
        columnas.fecha = columna;
      } else {
        columnas[regla.campo] = columna;
      }
    });
    if (columnas.fecha >= 0 && (columnas.monto != null || columnas.debito != null || columnas.credito != null)) {
      return { fila: indice, columnas };
    }
  }
  return null;
}

const MESES: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

function dia(year: number, month: number, day: number): string | null {
  if (year < 100) {
    year += 2000;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Fechas de bancos dominicanos: día primero (05/10/2026, 05-10-26, 05-Oct-2026) o ISO. Excel guarda la fecha como número de serie. */
export function leerFechaBanco(raw: string): string | null {
  const value = normal(raw).replace(/\./g, "");
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (match) {
    return dia(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(value);
  if (match) {
    return dia(Number(match[3]), Number(match[2]), Number(match[1]));
  }
  match = /^(\d{1,2})[\s/-]([a-z]{3})[a-z]*[\s/-](\d{2,4})/.exec(value);
  if (match && MESES[match[2]]) {
    return dia(Number(match[3]), MESES[match[2]], Number(match[1]));
  }
  if (/^\d{5}(\.\d+)?$/.test(raw.trim())) {
    const serial = Math.floor(Number(raw.trim()));
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    return dia(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  return null;
}

/** Monto con signo: -1.234,56, (1,234.56) y 1,234.56- cuentan como negativos. Null si no es un número. */
export function leerMontoBanco(raw: string): number | null {
  let value = raw.trim();
  if (!value) {
    return null;
  }
  let negativo = false;
  if (/^\(.*\)$/.test(value)) {
    negativo = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith("-")) {
    negativo = true;
    value = value.slice(1);
  } else if (value.endsWith("-")) {
    negativo = true;
    value = value.slice(0, -1);
  }
  const monto = parsePrice(value);
  if (monto == null) {
    return null;
  }
  return negativo ? -monto : monto;
}

function tipoDesdeTexto(value: string): BancoTipo | null {
  const texto = normal(value);
  if (/^(d|db|dr|deb|debito|debit|retiro|cargo)$/.test(texto)) {
    return "debito";
  }
  if (/^(c|cr|cred|credito|credit|deposito|abono)$/.test(texto)) {
    return "credito";
  }
  return null;
}

function celda(fila: string[], columna: number | null): string {
  return columna == null ? "" : (fila[columna] ?? "").trim();
}

/**
 * Lee el estado de cuenta ya partido en filas. Acepta débito y crédito en columnas separadas,
 * o un monto con signo (negativo es débito), o un monto con una columna de tipo.
 */
export function leerEstadoCuenta(filas: string[][]): EstadoCuentaLeido {
  const detectado = detectarColumnas(filas);
  if (!detectado) {
    throw new Error("El archivo no tiene una fila de encabezado con Fecha y Monto (o Débito y Crédito)");
  }
  const { columnas, fila } = detectado;
  const movimientos: BancoMovimientoEntrada[] = [];
  let descartadas = 0;
  for (const actual of filas.slice(fila + 1)) {
    const fecha = leerFechaBanco(celda(actual, columnas.fecha));
    let tipo: BancoTipo | null = null;
    let monto: number | null = null;
    const debito = leerMontoBanco(celda(actual, columnas.debito));
    const credito = leerMontoBanco(celda(actual, columnas.credito));
    if (debito) {
      tipo = "debito";
      monto = Math.abs(debito);
    } else if (credito) {
      tipo = "credito";
      monto = Math.abs(credito);
    } else {
      const firmado = leerMontoBanco(celda(actual, columnas.monto));
      if (firmado) {
        tipo = tipoDesdeTexto(celda(actual, columnas.tipo)) ?? (firmado < 0 ? "debito" : "credito");
        monto = Math.abs(firmado);
      }
    }
    if (!fecha || !tipo || !monto) {
      descartadas += 1;
      continue;
    }
    movimientos.push({
      fecha,
      descripcion: celda(actual, columnas.descripcion).slice(0, 500) || null,
      referencia: celda(actual, columnas.referencia).slice(0, 160) || null,
      tipo,
      monto: Math.round(monto * 100) / 100,
    });
  }
  return { columnas, encabezados: filas[fila], movimientos, descartadas };
}

/**
 * Llave estable de cada fila. Dos filas idénticas en el mismo archivo (dos transferencias iguales el mismo día)
 * se distinguen por el orden en que aparecen, así reimportar el archivo no las duplica ni las junta.
 */
export function llavesMovimientos(banco: string, cuenta: string | null, movimientos: BancoMovimientoEntrada[]): string[] {
  const vistas = new Map<string, number>();
  return movimientos.map((movimiento) => {
    const base = [normal(banco), normal(cuenta ?? ""), movimiento.fecha, movimiento.tipo, movimiento.monto.toFixed(2), normal(movimiento.descripcion ?? ""), normal(movimiento.referencia ?? "")].join("|");
    const vez = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, vez);
    return `${base}|${vez}`;
  });
}

/** Días que hay entre la fecha y la ventana [desde, hasta]. Cero si cae dentro; negativo si es antes. */
export function distanciaVentana(fecha: string, desde: string, hasta: string): number {
  if (fecha < desde) {
    return -diffDayKeys(fecha, desde);
  }
  if (fecha > hasta) {
    return diffDayKeys(hasta, fecha);
  }
  return 0;
}

/** Del día de emisión (o de recibida) hasta el vencimiento, más un día antes. */
export function ventanaBanco(factura: { fechaEmision: string | null; fechaVencimiento: string | null; recibidaDia: string }): { desde: string; hasta: string } {
  const desde = factura.fechaEmision ?? factura.recibidaDia;
  const vence = factura.fechaVencimiento && factura.fechaVencimiento >= desde ? factura.fechaVencimiento : desde;
  return { desde: addDaysToDayKey(desde, -1), hasta: vence };
}
