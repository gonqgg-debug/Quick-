"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFINICIONES, formatNumero, formatPct } from "@/lib/pos-domain";
import { formatDayKey } from "@/lib/local-day";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/DataTable";
import { Definicion, Vacio } from "@/components/admin/consumo/ui";

export function ConsumoCanastaVista({
  semana,
  rows,
  nextCursor,
}: {
  semana: string;
  rows: Array<{ productoA: string; productoB: string; ordenesJuntas: number; soporte: number; lift: number | null; ordenesSemana: number }>;
  nextCursor: string | null;
}) {
  const router = useRouter();
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center text-sm font-semibold text-[#111827]">
            Pares de la semana
            <Definicion texto={DEFINICIONES.lift} />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">Semana del {formatDayKey(semana)}. Solo pares con al menos 5 órdenes.</p>
        </div>
        <label className="text-xs font-medium text-brand-muted">
          Semana
          <input
            type="date"
            defaultValue={semana}
            onChange={(event) => {
              if (event.target.value) {
                router.push(`/admin/consumo/canasta?semana=${event.target.value}`);
              }
            }}
            className="mt-1 block rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {rows.length === 0 ? (
        <div className="mt-4">
          <Vacio titulo="Esta semana no hay pares" detalle="Ningún par llega a 5 órdenes juntas." />
        </div>
      ) : (
        <DataTable className="mt-4" tableClassName="min-w-[720px]">
          <DataTableHead>
            <DataTableTh>Producto A</DataTableTh>
            <DataTableTh>Producto B</DataTableTh>
            <DataTableTh numeric>Órdenes juntas</DataTableTh>
            <DataTableTh numeric>Soporte</DataTableTh>
            <DataTableTh numeric>Lift</DataTableTh>
          </DataTableHead>
          <tbody>
            {rows.map((row) => (
              <DataTableRow key={`${row.productoA}-${row.productoB}`}>
                <DataTableCell className="font-semibold">{row.productoA}</DataTableCell>
                <DataTableCell className="font-semibold">{row.productoB}</DataTableCell>
                <DataTableCell numeric>{formatNumero(row.ordenesJuntas)}</DataTableCell>
                <DataTableCell numeric>{formatPct(row.soporte).replace("+", "")}</DataTableCell>
                <DataTableCell numeric>
                  <span className={row.lift != null && row.lift > 1 ? "font-semibold text-[#166534]" : ""}>
                    {row.lift == null ? "—" : formatNumero(row.lift, 2)}
                  </span>
                </DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      )}
      {nextCursor ? (
        <Link href={`/admin/consumo/canasta?semana=${semana}&cursor=${encodeURIComponent(nextCursor)}`} className="mt-4 inline-block text-sm font-semibold" style={{ color: "#3F6B1C" }}>
          Siguiente
        </Link>
      ) : null}
    </div>
  );
}
