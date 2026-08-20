export type ImportField = "nombre" | "marca" | "categoria" | "precio" | "codigoBarras";

export type ImportRow = {
  codigo: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  precio: number;
  codigoBarras: string | null;
};

export type FieldChange = {
  field: ImportField;
  from: string | number | null;
  to: string | number | null;
  fromLabel: string;
  toLabel: string;
};

export type ImportNewItem = ImportRow;
export type ImportUpdateItem = ImportRow & { id: string; changes: FieldChange[] };
export type ImportUnchangedItem = { codigo: string; nombre: string };
export type ImportInvalidItem = { row: number; codigo: string; reason: string };
export type ImportMissingItem = { id: string; codigo: string | null; nombre: string };

export type ImportPreview = {
  fileName: string;
  columns: Partial<Record<"codigo" | ImportField, string>>;
  totals: {
    rows: number;
    created: number;
    updated: number;
    unchanged: number;
    invalid: number;
    missing: number;
  };
  created: ImportNewItem[];
  updated: ImportUpdateItem[];
  unchanged: ImportUnchangedItem[];
  invalid: ImportInvalidItem[];
  missing: ImportMissingItem[];
};
