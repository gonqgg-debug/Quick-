/** Comprobantes fiscales de la DGII: serie B (B + tipo + 8 dígitos) y e-CF (E + tipo + 10 dígitos). */

const TIPOS_B: Record<string, string> = {
  "01": "Crédito fiscal",
  "02": "Consumo",
  "03": "Nota de débito",
  "04": "Nota de crédito",
  "11": "Comprobante de compras",
  "12": "Registro único de ingresos",
  "13": "Gastos menores",
  "14": "Regímenes especiales",
  "15": "Gubernamental",
  "16": "Exportaciones",
  "17": "Pagos al exterior",
};

const TIPOS_E: Record<string, string> = {
  "31": "Crédito fiscal electrónico",
  "32": "Consumo electrónico",
  "33": "Nota de débito electrónica",
  "34": "Nota de crédito electrónica",
  "41": "Compras electrónico",
  "43": "Gastos menores electrónico",
  "44": "Regímenes especiales electrónico",
  "45": "Gubernamental electrónico",
  "46": "Exportaciones electrónico",
  "47": "Pagos al exterior electrónico",
};

export type NcfRevision =
  | { ok: true; ncf: string; serie: "B" | "E"; tipo: string; tipoLabel: string; esNotaCredito: boolean }
  | { ok: false; ncf: string; motivo: string };

export function compactarNcf(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function revisarNcf(value: string): NcfRevision {
  const ncf = compactarNcf(value);
  const serie = ncf.charAt(0);
  if (serie === "B") {
    if (!/^B[0-9]{10}$/.test(ncf)) {
      return { ok: false, ncf, motivo: "Un NCF de serie B tiene 11 caracteres: B, el tipo de 2 dígitos y 8 dígitos de secuencia" };
    }
    const tipo = ncf.slice(1, 3);
    const tipoLabel = TIPOS_B[tipo];
    if (!tipoLabel) {
      return { ok: false, ncf, motivo: `B${tipo} no es un tipo de comprobante de la DGII` };
    }
    return { ok: true, ncf, serie: "B", tipo: `B${tipo}`, tipoLabel, esNotaCredito: tipo === "04" };
  }
  if (serie === "E") {
    if (!/^E[0-9]{12}$/.test(ncf)) {
      return { ok: false, ncf, motivo: "Un e-CF tiene 13 caracteres: E, el tipo de 2 dígitos y 10 dígitos de secuencia" };
    }
    const tipo = ncf.slice(1, 3);
    const tipoLabel = TIPOS_E[tipo];
    if (!tipoLabel) {
      return { ok: false, ncf, motivo: `E${tipo} no es un tipo de e-CF de la DGII` };
    }
    return { ok: true, ncf, serie: "E", tipo: `E${tipo}`, tipoLabel, esNotaCredito: tipo === "34" };
  }
  return { ok: false, ncf, motivo: "El NCF tiene que empezar con B o con E" };
}
