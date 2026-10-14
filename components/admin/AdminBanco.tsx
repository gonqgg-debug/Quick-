"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminInput, AdminSelect, adminLabelClass } from "@/components/admin/AdminField";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/DataTable";
import { BotonPrincipal, Pill, TONO, fechaCorta } from "@/components/admin/facturas/ui";
import type { BancoMovimiento } from "@/lib/banco-shared";
import { formatMonto } from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";

type Importacion = { banco: string; nuevos: number; repetidos: number; descartadas: number; desde: string | null; hasta: string | null; encabezados: string[] };

type Filtro = "sin_ligar" | "debitos" | "todos";

export function AdminBanco() {
  const [movimientos, setMovimientos] = useState<BancoMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("sin_ligar");
  const [banco, setBanco] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<Importacion | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtro !== "todos") {
      params.set("tipo", "debito");
    }
    if (filtro === "sin_ligar") {
      params.set("sinLigar", "true");
    }
    try {
      const response = await fetch(`/api/admin/banco?${params.toString()}`, { credentials: "include" });
      const body = (await response.json()) as { movimientos?: BancoMovimiento[]; error?: string };
      if (!response.ok) {
        throw new Error(body.error || "No pudimos cargar el banco");
      }
      setMovimientos(body.movimientos ?? []);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos cargar el banco");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function importar() {
    if (!archivo) {
      return;
    }
    setSubiendo(true);
    setError(null);
    setResultado(null);
    try {
      const form = new FormData();
      form.set("archivo", archivo);
      form.set("banco", banco);
      if (cuenta.trim()) {
        form.set("cuenta", cuenta.trim());
      }
      const response = await fetch("/api/admin/banco", { method: "POST", credentials: "include", body: form });
      const body = (await response.json()) as { importacion?: Importacion; error?: string };
      if (!response.ok || !body.importacion) {
        throw new Error(body.error || "No pudimos importar el estado de cuenta");
      }
      setResultado(body.importacion);
      setArchivo(null);
      if (input.current) {
        input.current.value = "";
      }
      await cargar();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos importar el estado de cuenta");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Finanzas</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Banco</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-muted">
        Sube el estado de cuenta en CSV o Excel. Cada débito queda disponible para ligarlo como pago en la ficha de la factura. Subir el mismo archivo dos veces no duplica movimientos.
      </p>

      <section className="mt-5 rounded-2xl bg-white p-4" style={{ border: "1px solid #E7EBE4" }}>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
          <label className={adminLabelClass}>
            Banco
            <AdminInput value={banco} onChange={(event) => setBanco(event.target.value)} placeholder="Popular, BHD, Banreservas" />
          </label>
          <label className={adminLabelClass}>
            Cuenta (opcional)
            <AdminInput value={cuenta} onChange={(event) => setCuenta(event.target.value)} placeholder="Últimos 4 dígitos" />
          </label>
          <label className={adminLabelClass}>
            Archivo
            <input
              ref={input}
              type="file"
              accept=".csv,.txt,.xlsx"
              onChange={(event) => setArchivo(event.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-sm"
            />
          </label>
          <BotonPrincipal disabled={subiendo || !archivo || !banco.trim()} onClick={() => void importar()}>
            {subiendo ? "Importando..." : "Importar"}
          </BotonPrincipal>
        </div>
        <p className="mt-2 text-xs text-brand-muted">
          Lee la fila de encabezado sola: necesita Fecha y Monto, o Débito y Crédito. También usa Descripción y Referencia si las trae.
        </p>
        {resultado ? (
          <p className="mt-3 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: brand.paleGreen, color: "#3F6212" }}>
            {resultado.nuevos === 1 ? "1 movimiento nuevo" : `${resultado.nuevos} movimientos nuevos`} de {resultado.banco}
            {resultado.desde ? ` del ${fechaCorta(resultado.desde)} al ${fechaCorta(resultado.hasta)}` : ""}.
            {resultado.repetidos ? ` ${resultado.repetidos} ya estaban.` : ""}
            {resultado.descartadas ? ` ${resultado.descartadas} filas sin fecha o sin monto se saltaron (saldos o totales).` : ""}
          </p>
        ) : null}
      </section>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Movimientos</h2>
        <div className="w-48">
          <AdminSelect value={filtro} onChange={(event) => setFiltro(event.target.value as Filtro)} aria-label="Filtro">
            <option value="sin_ligar">Débitos sin ligar</option>
            <option value="debitos">Todos los débitos</option>
            <option value="todos">Todo</option>
          </AdminSelect>
        </div>
      </div>
      {loading ? <div className="mt-3 h-40 animate-pulse rounded-2xl bg-[#F3F4F6]" /> : null}
      {!loading && movimientos.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white px-4 py-6 text-sm text-brand-muted" style={{ border: "1px solid #E7EBE4" }}>
          {filtro === "sin_ligar" ? "No hay débitos sin ligar." : "Todavía no hay movimientos importados."}
        </p>
      ) : null}
      {!loading && movimientos.length > 0 ? (
        <div className="mt-3">
          <DataTable>
            <DataTableHead>
              <DataTableTh>Fecha</DataTableTh>
              <DataTableTh>Banco</DataTableTh>
              <DataTableTh>Descripción</DataTableTh>
              <DataTableTh numeric>Monto</DataTableTh>
              <DataTableTh>Factura</DataTableTh>
            </DataTableHead>
            <tbody>
              {movimientos.map((movimiento) => (
                <DataTableRow key={movimiento.id}>
                  <DataTableCell className="whitespace-nowrap">{fechaCorta(movimiento.fecha)}</DataTableCell>
                  <DataTableCell className="whitespace-nowrap">
                    {movimiento.banco}
                    {movimiento.cuenta ? <span className="block text-xs text-brand-muted">{movimiento.cuenta}</span> : null}
                  </DataTableCell>
                  <DataTableCell>
                    {movimiento.descripcion ?? "—"}
                    {movimiento.referencia ? <span className="block text-xs text-brand-muted">Ref. {movimiento.referencia}</span> : null}
                  </DataTableCell>
                  <DataTableCell numeric className="whitespace-nowrap font-semibold">
                    {movimiento.tipo === "debito" ? "− " : "+ "}
                    {formatMonto(movimiento.monto, movimiento.moneda)}
                  </DataTableCell>
                  <DataTableCell>
                    {movimiento.factura ? (
                      <Link href={`/admin/facturas/${movimiento.factura.id}`} className="font-semibold underline">
                        {movimiento.factura.referencia}
                      </Link>
                    ) : movimiento.tipo === "debito" ? (
                      <Pill label="Sin ligar" tone={TONO.gris} />
                    ) : (
                      "—"
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
        </div>
      ) : null}
    </div>
  );
}
