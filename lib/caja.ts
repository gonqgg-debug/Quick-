import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type Caja = "Fuerte" | "Chica";
export type CajaMoneda = "DOP" | "USD";

export type CajaParametros = {
  saldoInicialCajaFuerteDop: number;
  saldoInicialCajaFuerteUsd: number;
  saldoInicialCajaChicaDop: number;
  objetivoCajaChicaDop: number;
  tasaUsdDop: number;
};

export type CajaTurno = {
  reportadoEfectivo: number;
  reportadoUsd: number;
  tasaUsdDop: number;
  reportadoTarjeta: number;
  sistemaTarjeta: number;
  sistemaEfectivo: number;
  verificado: boolean;
};

export type CajaVarianzas = {
  varTarjeta: number;
  varEfectivo: number;
  efectivoTotalDop: number;
  varTotal: number;
};

export type CajaBalances = {
  chicaDop: number;
  fuerteDop: number;
  fuerteUsd: number;
};

export type CajaAsignacionSugerida = {
  objetivoCajaChica: number;
  saldoEsperadoChica: number;
  recomendadoMoverAChica: number;
  saldoEsperadoFuerteAntes: number;
  fuerteEstimadoPostMovimiento: number;
  usdEnFuerte: number;
};

const QUERY_LIMIT = 2000;
const PARAMETROS_FIELDS =
  "saldo_inicial_caja_fuerte_dop, saldo_inicial_caja_fuerte_usd, saldo_inicial_caja_chica_dop, objetivo_caja_chica_dop, tasa_usd_dop";
const TURNO_FIELDS =
  "reportado_efectivo, reportado_usd, reportado_tarjeta, sistema_tarjeta, sistema_efectivo, verificado";

type LedgerRow = { monto?: unknown; tipo?: unknown; caja?: unknown; moneda?: unknown };

function pickAmount(row: Record<string, unknown>, camel: string, snake: string): number {
  return toMoney(row[camel] ?? row[snake]);
}

export function mapCajaTurno(row: Record<string, unknown> | null | undefined): CajaTurno {
  const data = row ?? {};
  return {
    reportadoEfectivo: pickAmount(data, "reportadoEfectivo", "reportado_efectivo"),
    reportadoUsd: pickAmount(data, "reportadoUsd", "reportado_usd"),
    tasaUsdDop: pickAmount(data, "tasaUsdDop", "tasa_usd_dop"),
    reportadoTarjeta: pickAmount(data, "reportadoTarjeta", "reportado_tarjeta"),
    sistemaTarjeta: pickAmount(data, "sistemaTarjeta", "sistema_tarjeta"),
    sistemaEfectivo: pickAmount(data, "sistemaEfectivo", "sistema_efectivo"),
    verificado: Boolean(data.verificado),
  };
}

function mapParametros(data: Record<string, unknown> | null): CajaParametros {
  if (!data) {
    throw new Error("No hay parámetros de caja configurados");
  }
  return {
    saldoInicialCajaFuerteDop: toMoney(data.saldo_inicial_caja_fuerte_dop),
    saldoInicialCajaFuerteUsd: toMoney(data.saldo_inicial_caja_fuerte_usd),
    saldoInicialCajaChicaDop: toMoney(data.saldo_inicial_caja_chica_dop),
    objetivoCajaChicaDop: toMoney(data.objetivo_caja_chica_dop),
    tasaUsdDop: toMoney(data.tasa_usd_dop),
  };
}

function saldoInicial(parametros: CajaParametros, caja: Caja, moneda: CajaMoneda): number {
  if (caja === "Chica" && moneda === "USD") {
    return 0;
  }
  if (caja === "Fuerte" && moneda === "USD") {
    return parametros.saldoInicialCajaFuerteUsd;
  }
  if (caja === "Fuerte" && moneda === "DOP") {
    return parametros.saldoInicialCajaFuerteDop;
  }
  return parametros.saldoInicialCajaChicaDop;
}

async function listAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + QUERY_LIMIT - 1);
    if (error) {
      throw error;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < QUERY_LIMIT) {
      return rows;
    }
    from += QUERY_LIMIT;
  }
}

async function listTurnosVerificados(): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseAdminClient();
  return listAll<Record<string, unknown>>(async (from, to) =>
    supabase.from("caja_turnos").select(TURNO_FIELDS).eq("verificado", true).range(from, to)
  );
}

function turnosConTasa(rows: Record<string, unknown>[], tasaUsdDop: number): CajaTurno[] {
  return rows.map((row) => mapCajaTurno({ ...row, tasaUsdDop }));
}

async function listLedger(caja: Caja, moneda: CajaMoneda): Promise<LedgerRow[]> {
  const supabase = getSupabaseAdminClient();
  return listAll<LedgerRow>(async (from, to) =>
    supabase.from("caja_ledger").select("monto, tipo").eq("caja", caja).eq("moneda", moneda).range(from, to)
  );
}

function sumLedger(rows: LedgerRow[], tipo: "Entrada" | "Salida"): number {
  return rows.reduce((sum, row) => sum + (row.tipo === tipo ? toMoney(row.monto) : 0), 0);
}

function entradasTurnos(turnos: CajaTurno[], caja: Caja, moneda: CajaMoneda): number {
  if (caja !== "Fuerte") {
    return 0;
  }
  if (moneda === "USD") {
    return turnos.reduce((sum, turno) => sum + turno.reportadoUsd, 0);
  }
  return turnos.reduce((sum, turno) => sum + getEfectivoTotalDop(turno), 0);
}

function balanceFrom(
  parametros: CajaParametros,
  turnos: CajaTurno[],
  ledger: LedgerRow[],
  caja: Caja,
  moneda: CajaMoneda
): number {
  if (caja === "Chica" && moneda === "USD") {
    return 0;
  }
  return (
    saldoInicial(parametros, caja, moneda) +
    entradasTurnos(turnos, caja, moneda) +
    sumLedger(ledger, "Entrada") -
    sumLedger(ledger, "Salida")
  );
}

export async function getCajaParametros(): Promise<CajaParametros> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("caja_parametros").select(PARAMETROS_FIELDS).limit(1).maybeSingle();
  if (error) {
    throw error;
  }
  return mapParametros(data as Record<string, unknown> | null);
}

export function getEfectivoTotalDop(turno: CajaTurno | Record<string, unknown>): number {
  const mapped = mapCajaTurno(turno);
  return mapped.reportadoEfectivo - mapped.reportadoUsd * mapped.tasaUsdDop;
}

export function getVarianzas(turno: CajaTurno | Record<string, unknown>): CajaVarianzas {
  const mapped = mapCajaTurno(turno);
  const efectivoTotalDop = getEfectivoTotalDop(mapped);
  const usdEnDop = mapped.reportadoUsd * mapped.tasaUsdDop;
  return {
    varTarjeta: mapped.reportadoTarjeta - mapped.sistemaTarjeta,
    varEfectivo: mapped.reportadoEfectivo - mapped.sistemaEfectivo,
    efectivoTotalDop,
    varTotal:
      mapped.reportadoTarjeta + efectivoTotalDop + usdEnDop - (mapped.sistemaTarjeta + mapped.sistemaEfectivo),
  };
}

export async function getBalance(caja: Caja, moneda: CajaMoneda): Promise<number> {
  if (caja === "Chica" && moneda === "USD") {
    return 0;
  }
  const [parametros, turnoRows, ledger] = await Promise.all([
    getCajaParametros(),
    caja === "Fuerte" ? listTurnosVerificados() : Promise.resolve([] as Record<string, unknown>[]),
    listLedger(caja, moneda),
  ]);
  return balanceFrom(parametros, turnosConTasa(turnoRows, parametros.tasaUsdDop), ledger, caja, moneda);
}

export async function getTodosLosBalances(): Promise<CajaBalances> {
  const supabase = getSupabaseAdminClient();
  const [parametros, turnoRows, ledger] = await Promise.all([
    getCajaParametros(),
    listTurnosVerificados(),
    listAll<LedgerRow>(async (from, to) =>
      supabase.from("caja_ledger").select("monto, tipo, caja, moneda").range(from, to)
    ),
  ]);
  const turnos = turnosConTasa(turnoRows, parametros.tasaUsdDop);
  const ledgerOf = (caja: Caja, moneda: CajaMoneda) =>
    ledger.filter((row) => row.caja === caja && row.moneda === moneda);
  return {
    chicaDop: balanceFrom(parametros, turnos, ledgerOf("Chica", "DOP"), "Chica", "DOP"),
    fuerteDop: balanceFrom(parametros, turnos, ledgerOf("Fuerte", "DOP"), "Fuerte", "DOP"),
    fuerteUsd: balanceFrom(parametros, turnos, ledgerOf("Fuerte", "USD"), "Fuerte", "USD"),
  };
}

export async function getAsignacionSugerida(): Promise<CajaAsignacionSugerida> {
  const [parametros, balances] = await Promise.all([getCajaParametros(), getTodosLosBalances()]);
  const recomendadoMoverAChica = Math.max(0, parametros.objetivoCajaChicaDop - balances.chicaDop);
  return {
    objetivoCajaChica: parametros.objetivoCajaChicaDop,
    saldoEsperadoChica: balances.chicaDop,
    recomendadoMoverAChica,
    saldoEsperadoFuerteAntes: balances.fuerteDop,
    fuerteEstimadoPostMovimiento: balances.fuerteDop - recomendadoMoverAChica,
    usdEnFuerte: balances.fuerteUsd,
  };
}
