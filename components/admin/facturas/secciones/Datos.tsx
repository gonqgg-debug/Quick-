import { formatMonto, type FacturaDetalle } from "@/lib/facturas-shared";
import { diferenciaMontos } from "@/components/admin/facturas/falta";
import { Aviso, Dato, Seccion, TONO, fechaCorta, fechaHora } from "@/components/admin/facturas/ui";

export function Datos({ factura }: { factura: FacturaDetalle }) {
  const diferencia = diferenciaMontos(factura);
  const monto = (value: number | null) => formatMonto(value, factura.moneda);
  return (
    <Seccion id="datos" titulo="Datos">
      <div className="space-y-4">
        {factura.posibleDuplicado ? (
          <Aviso tone={TONO.naranja}>Posible duplicado{factura.duplicadoReferencia ? ` de ${factura.duplicadoReferencia}` : ""}.</Aviso>
        ) : null}
        <Grupo titulo="Proveedor">
          <Dato label="Nombre" value={factura.proveedor} />
          <Dato label="RNC" value={factura.rnc} />
          <Dato label="NCF" value={factura.ncf} />
          <Dato label="Número" value={factura.numeroFactura} />
          <Dato label="Tipo" value={factura.tipoDocumentoLabel} />
          <Dato label="Tienda" value={factura.tienda} />
        </Grupo>
        <Grupo titulo="Fechas y pago">
          <Dato label="Emisión" value={fechaCorta(factura.fechaEmision)} />
          <Dato label="Vencimiento" value={fechaCorta(factura.fechaVencimiento)} />
          <Dato label="Condición" value={factura.condicionLabel} />
          <Dato label="Método de pago" value={factura.metodoPago} />
          <Dato label="Recibida" value={fechaHora(factura.recibidoEn)} />
          <Dato label="Envió" value={factura.enviadoPor} />
        </Grupo>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-brand-muted">Montos</h3>
          <dl className="mt-2 divide-y divide-[#F1F5F9] rounded-xl border border-[#E7EBE4] text-sm">
            <Fila label="Subtotal" value={monto(factura.subtotal)} />
            <Fila label="Descuento" value={factura.descuentoTotal ? `− ${monto(factura.descuentoTotal)}` : monto(factura.descuentoTotal)} />
            <Fila label="ITBIS" value={monto(factura.itbisTotal)} />
            <Fila label="Otros cargos" value={monto(factura.otrosCargos)} />
            <Fila label="Total" value={monto(factura.total)} strong />
          </dl>
          {diferencia ? (
            <p className="mt-2 text-sm font-semibold" style={{ color: "#991B1B" }}>
              Subtotal, descuento, ITBIS y otros cargos dan {diferencia > 0 ? "más" : "menos"} que el total, por {monto(Math.abs(diferencia))}.
            </p>
          ) : null}
        </div>
      </div>
    </Seccion>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-brand-muted">{titulo}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">{children}</dl>
    </div>
  );
}

function Fila({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className={strong ? "font-bold" : "text-brand-muted"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-base font-bold" : "font-semibold"}`}>{value}</dd>
    </div>
  );
}
