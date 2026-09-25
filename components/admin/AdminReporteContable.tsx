"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import { formatUsd } from "@/lib/admin-caja-shared";
import { monthInputValue } from "@/lib/admin-parametros-shared";
import type { ReporteFinanciero } from "@/lib/admin-reporte-shared";
import type {
  ContableCompra,
  ContableLedger,
  ContablePago,
  ContablePedido,
  ContableProveedor,
  ContableTurno,
  ContableVenta,
  ReporteContable,
} from "@/lib/admin-reporte-contable-shared";
import { brand } from "@/lib/theme";
import { AdminInput, AdminSelect, adminLabelClass } from "@/components/admin/AdminField";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";

export function AdminReporteContable() {
  const router = useRouter();
  const [reporte, setReporte] = useState<ReporteContable | null>(null);
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mesKey?: string) => {
      const url = mesKey ? `/api/admin/reporte/contable?mes=${encodeURIComponent(mesKey)}` : "/api/admin/reporte/contable";
      const response = await fetch(url, { credentials: "include" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as ReporteContable | { error?: string } | null;
      if (!response.ok || !body || !("ventasDiarias" in body)) {
        throw new Error((body && "error" in body && body.error) || "No pudimos armar el detalle contable");
      }
      setReporte(body);
      const nextMes = monthInputValue(body.mes);
      setMes(nextMes);
      setError(null);
      window.history.replaceState(null, "", `/admin/reporte/contable?mes=${encodeURIComponent(nextMes)}`);
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;
    const initial = new URLSearchParams(window.location.search).get("mes") ?? "";
    (async () => {
      setLoading(true);
      try {
        const [monthsResponse] = await Promise.all([
          fetch("/api/admin/reporte", { credentials: "include" }),
          load(initial || undefined),
        ]);
        if (monthsResponse.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const monthsBody = (await monthsResponse.json().catch(() => null)) as ReporteFinanciero | null;
        if (!cancelled && monthsBody && "meses" in monthsBody) {
          setMeses(monthsBody.meses.map((item) => monthInputValue(item.mes)));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function selectMes(next: string) {
    if (!next || next === mes) {
      return;
    }
    setMes(next);
    setSwitching(true);
    try {
      await load(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al cargar el mes");
    } finally {
      setSwitching(false);
    }
  }

  const needle = query.trim().toLowerCase();
  const match = useCallback(
    (row: object) => !needle || JSON.stringify(row).toLowerCase().includes(needle),
    [needle]
  );
  const ventas = useMemo(() => reporte?.ventasDiarias.filter(match) ?? [], [reporte, match]);
  const compras = useMemo(() => reporte?.compras.filter(match) ?? [], [reporte, match]);
  const pagos = useMemo(() => reporte?.pagosProveedores.filter(match) ?? [], [reporte, match]);
  const proveedores = useMemo(() => reporte?.proveedores.filter(match) ?? [], [reporte, match]);
  const turnos = useMemo(() => reporte?.turnos.filter(match) ?? [], [reporte, match]);
  const ledger = useMemo(() => reporte?.ledger.filter(match) ?? [], [reporte, match]);
  const pedidos = useMemo(() => reporte?.pedidos.filter(match) ?? [], [reporte, match]);
  const pruebas = useMemo(() => reporte?.pedidosPrueba.filter(match) ?? [], [reporte, match]);

  const monthOptions = meses.length > 0 ? meses : mes ? [mes] : [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Finanzas</p>
          <h1 className="font-display mt-1 text-2xl font-bold">Detalle contable</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">
            Cada factura, turno, movimiento de caja y pedido del mes, con el id de origen. El JSON es el paquete
            para armar y verificar la contabilidad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/reporte"
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: "#E5E7EB", color: brand.ink }}
          >
            Resumen
          </Link>
          <a
            href={mes ? `/api/admin/reporte/contable/export?mes=${encodeURIComponent(mes)}` : "/api/admin/reporte/contable/export"}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: brand.green }}
          >
            Descargar JSON
          </a>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-80 animate-pulse rounded-lg bg-gray-100" />
      ) : reporte ? (
        <div className={`mt-6 space-y-4 ${switching ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-end gap-3">
            <label className={`${adminLabelClass} max-w-xs`}>
              Mes
              {monthOptions.length > 0 ? (
                <AdminSelect value={mes} onChange={(event) => void selectMes(event.target.value)}>
                  {monthOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </AdminSelect>
              ) : (
                <AdminInput type="month" value={mes} onChange={(event) => void selectMes(event.target.value)} />
              )}
            </label>
            <label className={`${adminLabelClass} min-w-56 flex-1`}>
              Buscar en las líneas
              <AdminInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Proveedor, concepto, id, estado" />
            </label>
          </div>

          <section
            className="rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: reporte.revision.aritmeticaCuadra ? "#BBF7D0" : "#FECACA",
              backgroundColor: reporte.revision.aritmeticaCuadra ? "#F0FDF4" : "#FEF2F2",
            }}
          >
            <p className="font-semibold" style={{ color: reporte.revision.aritmeticaCuadra ? brand.green : brand.error }}>
              {reporte.revision.aritmeticaCuadra
                ? "Las sumas del paquete cuadran entre sí."
                : "Hay comprobaciones que no cuadran."}
            </p>
            <p className="mt-1 text-brand-muted">
              {reporte.label}. {reporte.conteos.ventas} ventas, {reporte.conteos.compras} compras,{" "}
              {reporte.conteos.pagos} pagos, {reporte.conteos.turnos} turnos, {reporte.conteos.ledger} movimientos de
              caja, {reporte.conteos.pedidos} pedidos.
              {reporte.revision.alertas > 0 ? ` ${reporte.revision.alertas} advertencias.` : ""}
            </p>
          </section>

          {reporte.advertencias.length > 0 ? (
            <section className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm">
              <h2 className="font-semibold">Advertencias</h2>
              <ul className="mt-2 space-y-1">
                {reporte.advertencias.map((alerta) => (
                  <li key={alerta.codigo}>{alerta.mensaje}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <Section title="Comprobaciones" count={reporte.comprobaciones.length}>
            <DataTable tableClassName="min-w-[760px]">
              <DataTableHead>
                <DataTableTh>Control</DataTableTh>
                <DataTableTh numeric>Calculado</DataTableTh>
                <DataTableTh numeric>Esperado</DataTableTh>
                <DataTableTh numeric>Diferencia</DataTableTh>
              </DataTableHead>
              <tbody>
                {reporte.comprobaciones.map((item) => (
                  <DataTableRow key={item.id}>
                    <DataTableCell>
                      <span className="font-semibold">{item.titulo}</span>
                      <span className="mt-0.5 block text-xs text-brand-muted">{item.formula}</span>
                    </DataTableCell>
                    <DataTableCell numeric>{formatPrice(item.izquierda)}</DataTableCell>
                    <DataTableCell numeric>{formatPrice(item.derecha)}</DataTableCell>
                    <DataTableCell numeric style={{ color: item.cuadra ? brand.green : brand.error }}>
                      {item.cuadra ? "Cuadra" : formatPrice(item.diferencia)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </tbody>
            </DataTable>
          </Section>

          {reporte.saldosAlCierre ? (
            <Section title="Saldos de caja al cierre" count={3}>
              <p className="mb-3 text-sm text-brand-muted">{reporte.saldosAlCierre.nota}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Stat label="Fuerte DOP" value={formatPrice(reporte.saldosAlCierre.fuerteDop)} />
                <Stat label="Fuerte USD" value={formatUsd(reporte.saldosAlCierre.fuerteUsd)} />
                <Stat label="Chica DOP" value={formatPrice(reporte.saldosAlCierre.chicaDop)} />
              </div>
              <p className="mt-3 text-xs text-brand-muted">
                {reporte.saldosAlCierre.turnosVerificadosHastaCierre} turnos verificados hasta el cierre. Efectivo
                acumulado {formatPrice(reporte.saldosAlCierre.efectivoTurnosVerificadosDop)}. USD acumulado{" "}
                {formatUsd(reporte.saldosAlCierre.usdTurnosVerificados)}.
              </p>
            </Section>
          ) : null}

          <Section title="Ventas diarias" count={ventas.length}>
            <LineTable
              empty="No hay ventas en este mes"
              headers={["Fecha", "Día", "Venta", "Id"]}
              rows={ventas.map((venta) => (
                <VentaRow key={venta.id} venta={venta} />
              ))}
            />
          </Section>

          <Section title="Compras del mes" count={compras.length}>
            <LineTable
              empty="No hay facturas con fecha en este mes"
              headers={["Fecha", "Proveedor", "Monto", "Vence", "Pago", "Id"]}
              rows={compras.map((compra) => (
                <CompraRow key={compra.id} compra={compra} />
              ))}
              wide
            />
          </Section>

          <Section title="Pagos a proveedores" count={pagos.length}>
            <p className="mb-3 text-sm text-brand-muted">
              Incluye facturas de otros meses si se marcaron pagadas en {reporte.label}.
            </p>
            <LineTable
              empty="No hay pagos registrados en este mes"
              headers={["Pagada", "Factura", "Proveedor", "Monto", "Origen", "Id"]}
              rows={pagos.map((pago) => (
                <PagoRow key={pago.id} pago={pago} />
              ))}
              wide
            />
          </Section>

          <Section title="Proveedores con movimiento" count={proveedores.length}>
            <p className="mb-3 text-sm text-brand-muted">
              {reporte.conteos.proveedoresSinMovimiento} proveedores del catálogo no tuvieron facturas ni pagos en el mes.
            </p>
            <LineTable
              empty="Ningún proveedor tuvo movimiento"
              headers={["Proveedor", "Facturado", "Pendiente", "Pagado en el mes", "Crédito"]}
              rows={proveedores.map((proveedor) => (
                <ProveedorRow key={proveedor.id} proveedor={proveedor} />
              ))}
              wide
            />
          </Section>

          <Section title="Turnos" count={turnos.length}>
            <LineTable
              empty="No hay turnos en este mes"
              headers={["Fecha", "Turno", "Tarjeta", "Efectivo DOP", "USD", "Varianza", "Verificado", "Id"]}
              rows={turnos.map((turno) => (
                <TurnoRow key={turno.id} turno={turno} />
              ))}
              wide
            />
          </Section>

          <Section title="Ledger de caja" count={ledger.length}>
            <LineTable
              empty="No hay movimientos de caja en este mes"
              headers={["Fecha", "Caja", "Tipo", "Monto", "Concepto", "Referencia", "Id"]}
              rows={ledger.map((row) => (
                <LedgerRow key={row.id} row={row} />
              ))}
              wide
            />
          </Section>

          <Section title="Pedidos" count={pedidos.length}>
            <p className="mb-3 text-sm text-brand-muted">
              Delivery cobrado {formatPrice(reporte.resumen.deliveryCobrado)}. No se suma a la venta de tienda (
              {formatPrice(reporte.cruces.delivery.diferencia)} de diferencia).
            </p>
            <LineTable
              empty="No hay pedidos reales en este mes"
              headers={["Fecha", "Número", "Estado", "Pago", "Total", "Tienda", "Id"]}
              rows={pedidos.map((pedido) => (
                <PedidoRow key={pedido.id} pedido={pedido} />
              ))}
              wide
            />
          </Section>

          {reporte.conteos.pedidosPrueba > 0 ? (
            <Section title="Pedidos de prueba" count={pruebas.length}>
              <p className="mb-3 text-sm text-brand-muted">Están fuera de los totales cobrados.</p>
              <LineTable
                empty="Ninguna prueba coincide con la búsqueda"
                headers={["Fecha", "Número", "Estado", "Pago", "Total", "Tienda", "Id"]}
                rows={pruebas.map((pedido) => (
                  <PedidoRow key={pedido.id} pedido={pedido} />
                ))}
                wide
              />
            </Section>
          ) : null}

          {reporte.filasOmitidas.length > 0 ? (
            <Section title="Filas omitidas" count={reporte.filasOmitidas.length}>
              <DataTable>
                <DataTableHead>
                  <DataTableTh>Fuente</DataTableTh>
                  <DataTableTh>Id</DataTableTh>
                  <DataTableTh>Motivo</DataTableTh>
                </DataTableHead>
                <tbody>
                  {reporte.filasOmitidas.map((fila, index) => (
                    <DataTableRow key={`${fila.fuente}-${fila.id ?? index}`}>
                      <DataTableCell>{fila.fuente}</DataTableCell>
                      <IdCell id={fila.id} />
                      <DataTableCell>{fila.motivo}</DataTableCell>
                    </DataTableRow>
                  ))}
                </tbody>
              </DataTable>
            </Section>
          ) : null}

          <details className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-sm shadow-sm">
            <summary className="cursor-pointer font-semibold">Definiciones que viajan en el JSON</summary>
            <ul className="mt-3 space-y-2 text-brand-muted">
              {reporte.definiciones.map((item) => (
                <li key={item.campo}>
                  <span className="font-semibold text-brand-ink">{item.campo}. </span>
                  {item.significado}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details open className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <summary className="cursor-pointer font-display text-lg font-bold">
        {title}
        <span className="ml-2 text-sm font-semibold text-brand-muted">{count}</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function LineTable({
  headers,
  rows,
  empty,
  wide = false,
}: {
  headers: string[];
  rows: React.ReactNode[];
  empty: string;
  wide?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-brand-muted">{empty}</p>;
  }
  return (
    <DataTable tableClassName={wide ? "min-w-[860px]" : undefined}>
      <DataTableHead>
        {headers.map((header) => (
          <DataTableTh key={header} numeric={header !== "Fecha" && header !== "Día" && header !== "Proveedor" && header !== "Pago" && header !== "Vence" && header !== "Origen" && header !== "Crédito" && header !== "Turno" && header !== "Verificado" && header !== "Caja" && header !== "Tipo" && header !== "Concepto" && header !== "Referencia" && header !== "Número" && header !== "Estado" && header !== "Tienda" && header !== "Id"}>
            {header}
          </DataTableTh>
        ))}
      </DataTableHead>
      <tbody>{rows}</tbody>
    </DataTable>
  );
}

function VentaRow({ venta }: { venta: ContableVenta }) {
  return (
    <DataTableRow>
      <DataTableCell className="whitespace-nowrap">{venta.fecha}</DataTableCell>
      <DataTableCell>
        {venta.diaSemanaCalculado}
        {!venta.diaSemanaCoincide ? (
          <span className="mt-0.5 block text-xs" style={{ color: brand.orange }}>
            Registrado: {venta.diaSemanaRegistrado}
          </span>
        ) : null}
      </DataTableCell>
      <DataTableCell numeric>{formatPrice(venta.ventaReal)}</DataTableCell>
      <IdCell id={venta.id} />
    </DataTableRow>
  );
}

function CompraRow({ compra }: { compra: ContableCompra }) {
  return (
    <DataTableRow>
      <DataTableCell className="whitespace-nowrap">{compra.fecha}</DataTableCell>
      <DataTableCell className="font-semibold">{compra.proveedorNombre}</DataTableCell>
      <DataTableCell numeric>{formatPrice(compra.monto)}</DataTableCell>
      <DataTableCell className="whitespace-nowrap">
        {compra.dueDate}
        {compra.vencida ? (
          <span className="mt-0.5 block text-xs font-semibold" style={{ color: brand.error }}>
            Vencida
          </span>
        ) : null}
        {!compra.vencimientoCoincide ? (
          <span className="mt-0.5 block text-xs" style={{ color: brand.orange }}>
            Esperado {compra.vencimientoEsperado}
          </span>
        ) : null}
      </DataTableCell>
      <DataTableCell>{compra.pagado ? `Pagada ${compra.pagadoEn ?? ""}` : "Pendiente"}</DataTableCell>
      <IdCell id={compra.id} />
    </DataTableRow>
  );
}

function PagoRow({ pago }: { pago: ContablePago }) {
  return (
    <DataTableRow>
      <DataTableCell className="whitespace-nowrap">{pago.pagadoEn}</DataTableCell>
      <DataTableCell className="whitespace-nowrap">{pago.fecha}</DataTableCell>
      <DataTableCell className="font-semibold">{pago.proveedorNombre}</DataTableCell>
      <DataTableCell numeric>{formatPrice(pago.monto)}</DataTableCell>
      <DataTableCell>{pago.facturaDeOtroMes ? "Factura de otro mes" : "Factura del mes"}</DataTableCell>
      <IdCell id={pago.id} />
    </DataTableRow>
  );
}

function ProveedorRow({ proveedor }: { proveedor: ContableProveedor }) {
  return (
    <DataTableRow>
      <DataTableCell>
        <span className="font-semibold">{proveedor.nombre}</span>
        {proveedor.notas ? <span className="mt-0.5 block text-xs text-brand-muted">{proveedor.notas}</span> : null}
      </DataTableCell>
      <DataTableCell numeric>
        {formatPrice(proveedor.montoFacturadoEnMes)}
        <span className="mt-0.5 block text-xs text-brand-muted">
          {proveedor.facturasEnMes === 1 ? "1 factura" : `${proveedor.facturasEnMes} facturas`}
        </span>
      </DataTableCell>
      <DataTableCell numeric>{formatPrice(proveedor.pendienteEnMes)}</DataTableCell>
      <DataTableCell numeric>{formatPrice(proveedor.pagosEnMes)}</DataTableCell>
      <DataTableCell>{proveedor.tieneCredito ? `${proveedor.diasCredito} días` : "Contado"}</DataTableCell>
    </DataTableRow>
  );
}

function TurnoRow({ turno }: { turno: ContableTurno }) {
  return (
    <DataTableRow>
      <DataTableCell className="whitespace-nowrap">{turno.fecha}</DataTableCell>
      <DataTableCell>
        {turno.turno}
        {turno.notas ? <span className="mt-0.5 block max-w-48 truncate text-xs text-brand-muted">{turno.notas}</span> : null}
      </DataTableCell>
      <DataTableCell numeric>
        {formatPrice(turno.reportadoTarjeta)}
        <span className="mt-0.5 block text-xs text-brand-muted">Sistema {formatPrice(turno.sistemaTarjeta)}</span>
      </DataTableCell>
      <DataTableCell numeric>
        {formatPrice(turno.efectivoDop)}
        <span className="mt-0.5 block text-xs text-brand-muted">Reportado {formatPrice(turno.reportadoEfectivo)}</span>
      </DataTableCell>
      <DataTableCell numeric>{formatUsd(turno.reportadoUsd)}</DataTableCell>
      <DataTableCell numeric style={{ color: turno.varTotal === 0 ? brand.ink : turno.varTotal > 0 ? brand.green : brand.error }}>
        {formatPrice(turno.varTotal)}
      </DataTableCell>
      <DataTableCell>{turno.verificado ? "Sí" : "No"}</DataTableCell>
      <IdCell id={turno.id} />
    </DataTableRow>
  );
}

function LedgerRow({ row }: { row: ContableLedger }) {
  const monto = row.moneda === "USD" ? formatUsd(row.monto) : formatPrice(row.monto);
  return (
    <DataTableRow>
      <DataTableCell className="whitespace-nowrap">{row.fecha}</DataTableCell>
      <DataTableCell>
        {row.caja}
        <span className="mt-0.5 block text-xs text-brand-muted">{row.moneda}</span>
      </DataTableCell>
      <DataTableCell>{row.tipo}</DataTableCell>
      <DataTableCell numeric>{monto}</DataTableCell>
      <DataTableCell>{row.concepto ?? "—"}</DataTableCell>
      <DataTableCell>{row.referencia ?? "—"}</DataTableCell>
      <IdCell id={row.id} />
    </DataTableRow>
  );
}

function PedidoRow({ pedido }: { pedido: ContablePedido }) {
  return (
    <DataTableRow>
      <DataTableCell className="whitespace-nowrap">{pedido.fecha}</DataTableCell>
      <DataTableCell className="font-semibold">{pedido.numero}</DataTableCell>
      <DataTableCell>
        {pedido.estadoLabel}
        {pedido.cuentaComoCobrado ? <span className="mt-0.5 block text-xs text-brand-muted">Cobra</span> : null}
      </DataTableCell>
      <DataTableCell>
        {pedido.metodoPago || "—"}
        {pedido.pagoCon != null ? (
          <span className="mt-0.5 block text-xs text-brand-muted">Paga con {formatPrice(pedido.pagoCon)}</span>
        ) : null}
      </DataTableCell>
      <DataTableCell numeric>{formatPrice(pedido.totalEstimado)}</DataTableCell>
      <DataTableCell>{pedido.tienda || "—"}</DataTableCell>
      <IdCell id={pedido.id} />
    </DataTableRow>
  );
}

function IdCell({ id }: { id: string | null }) {
  return (
    <DataTableCell>
      <span className="font-mono text-xs" title={id ?? ""}>
        {id ? id.slice(0, 8) : "—"}
      </span>
    </DataTableCell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#F8FAF7" }}>
      <p className="text-xs text-brand-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
