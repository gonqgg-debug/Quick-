import Link from "next/link";
import { coberturaDifiere, desgloseVenta, DEFINICIONES_CONSUMO } from "@/lib/consumo-metricas";
import { formatDayKey } from "@/lib/local-day";
import { DEFINICIONES, formatNumero, formatPct, formatRd, formatUnidades } from "@/lib/pos-domain";
import type { ResumenConsumo } from "@/lib/pos-consumo";
import { MapaCalor, VentaDiaChart } from "@/components/admin/consumo/charts";
import { Delta, Dinero, Metrica, Pildora, Vacio } from "@/components/admin/consumo/ui";

export function ConsumoResumenVista({
  data,
  miles,
}: {
  data: ResumenConsumo;
  miles?: { hallazgos: Array<{ id: string; titulo: string; tipo: string; resumen: string }>; recomendaciones: number } | null;
}) {
  const query = `preset=custom&desde=${data.periodo.desde}&hasta=${data.periodo.hasta}&comparacion=${data.periodo.comparacion}`;
  const hayVenta = data.kpis.ordenes > 0 || data.kpis.venta !== 0;
  const mixTotal = data.mix.efectivo + data.mix.tarjeta + data.mix.banco + data.mix.credito + data.mix.otro;
  const estado = data.comparacionEstado;
  const base = data.kpisComparados ?? data.kpis;
  const desglose = data.anterior && base.ticket != null && data.anterior.ticket != null
    ? desgloseVenta({ tickets: base.ordenes, ticket: base.ticket }, { tickets: data.anterior.ordenes, ticket: data.anterior.ticket })
    : null;
  const coberturaAviso = coberturaDifiere(base.cobertura, data.anterior?.cobertura ?? null);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Metrica
          etiqueta="Venta"
          valor={formatRd(data.kpis.venta)}
          definicion={DEFINICIONES.venta}
          detalle="Incluye ITBIS"
          delta={<Delta estado={estado} actual={base.venta} anterior={data.anterior?.venta ?? null} />}
        />
        <Metrica
          etiqueta="Tickets"
          valor={formatNumero(data.kpis.ordenes)}
          definicion={DEFINICIONES.tickets}
          delta={<Delta estado={estado} formato="num" actual={base.ordenes} anterior={data.anterior?.ordenes ?? null} />}
        />
        <Metrica
          etiqueta="Ticket promedio"
          valor={formatRd(data.kpis.ticket)}
          definicion={DEFINICIONES.ticket}
          delta={<Delta estado={estado} actual={base.ticket} anterior={data.anterior?.ticket ?? null} />}
        />
        <Metrica
          etiqueta="Unidades por ticket"
          valor={formatNumero(data.kpis.unidadesPorTicket, 2)}
          definicion={DEFINICIONES.unidadesTicket}
          delta={<Delta estado={estado} formato="num" actual={base.unidadesPorTicket} anterior={data.anterior?.unidadesPorTicket ?? null} />}
        />
        <Metrica
          etiqueta="Margen calculado"
          valor={data.kpis.margen == null ? "Sin costo" : formatRd(data.kpis.margen)}
          definicion={DEFINICIONES.margen}
          detalle={detalleMargen(data)}
          delta={<Delta estado={estado} actual={base.margen} anterior={data.anterior?.margen ?? null} />}
        />
      </section>

      {desglose && estado === "ok" ? (
        <p className="text-sm text-brand-muted">
          El cambio de venta del tramo comparado es {formatRd(desglose.delta)}. {formatRd(desglose.efectoTickets)} vienen de la cantidad de tickets y {formatRd(desglose.efectoTicket)} del ticket promedio. Esos pesos se suman; los porcentajes no.
        </p>
      ) : null}
      {coberturaAviso ? (
        <p className="text-sm" style={{ color: "#92400E" }}>
          La cobertura de costo cambió de {formatPct(data.anterior?.cobertura).replace("+", "")} a {formatPct(base.cobertura).replace("+", "")}. Esa diferencia limita leer el cambio de margen como solo precio o costo.
        </p>
      ) : null}
      <p className="text-xs text-brand-muted">{DEFINICIONES_CONSUMO.costo}</p>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#111827]">Mix de pago</h2>
        <p className="mt-1 text-xs text-brand-muted">El efectivo ya tiene el vuelto restado. La suma de los medios es la venta.</p>
        {mixTotal > 0 ? (
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-[#F3F4F6]">
            <Barra ancho={(data.mix.efectivo / mixTotal) * 100} color="#7EB341" />
            <Barra ancho={(data.mix.tarjeta / mixTotal) * 100} color="#1F82C5" />
            <Barra ancho={(data.mix.banco / mixTotal) * 100} color="#111827" />
            <Barra ancho={(data.mix.credito / mixTotal) * 100} color="#F79521" />
            <Barra ancho={(data.mix.otro / mixTotal) * 100} color="#D1D5DB" />
          </div>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Medio nombre="Efectivo" monto={data.mix.efectivo} />
          <Medio nombre="Tarjeta" monto={data.mix.tarjeta} />
          <Medio nombre="Banco" monto={data.mix.banco} />
          <Medio nombre="Crédito" monto={data.mix.credito} />
          <Medio nombre="Otro" monto={data.mix.otro} />
        </dl>
      </section>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#111827]">Venta por día</h2>
          <p className="text-xs text-brand-muted">La línea es el periodo anterior. Un clic deja el día.</p>
        </div>
        <div className="mt-4">
          {hayVenta ? <VentaDiaChart dias={data.dias} anterior={data.diasAnterior} /> : <Vacio titulo="Todavía no hay sesiones de caja" detalle="La primera venta operativa es del 5 de septiembre de 2025. La caja empuja las sesiones cerradas a la 1:00 a.m." />}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Top por venta</h2>
            <Link href={`/admin/consumo/productos?${query}`} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
              Ver todos
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[#F3F4F6]">
            {data.top.length === 0 ? <li className="py-6 text-sm text-brand-muted">Sin productos en este periodo.</li> : null}
            {data.top.map((producto) => (
              <li key={producto.codigo}>
                <Link href={`/admin/consumo/productos/${encodeURIComponent(producto.codigo)}?${query}`} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="block text-sm font-semibold text-[#111827]">{producto.nombre}</span>
                    <span className="text-xs text-brand-muted">{formatUnidades(producto.unidades)} uds · {producto.categoria}</span>
                  </span>
                  <span className="text-right">
                    <Dinero value={producto.venta} className="block text-sm font-semibold" />
                    {producto.margen == null ? <Pildora tono="gris">Sin costo</Pildora> : <span className="text-xs tabular-nums text-brand-muted">{formatRd(producto.margen)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Horario</h2>
            <Link href={`/admin/consumo/horarios?${query}`} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
              Ver mapa
            </Link>
          </div>
          <div className="mt-3">
            <MapaCalor celdas={data.horas} metrica="venta" compacto />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#111827]">Miles</h2>
          <Link href="/admin/consumo/miles" className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
            Ver análisis
          </Link>
        </div>
        {!miles || miles.hallazgos.length === 0 ? (
          <p className="mt-3 text-sm text-brand-muted">Miles todavía no ha publicado análisis.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {miles.hallazgos.map((hallazgo) => (
              <li key={hallazgo.id}>
                <Link href={`/admin/consumo/miles?vista=hallazgos&hallazgo=${hallazgo.id}`} className="block">
                  <span className="text-sm font-semibold text-[#111827]">{hallazgo.titulo}</span>
                  <span className="mt-0.5 block text-xs text-brand-muted">{hallazgo.tipo} · {hallazgo.resumen}</span>
                </Link>
              </li>
            ))}
            <li className="text-xs text-brand-muted">Abre Miles para ver qué sigue vigente y qué ya tiene resolución.</li>
          </ul>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <TarjetaCalidad href={`/admin/consumo/calidad?cola=match&${query}`} titulo="Sin match" detalle={`${formatNumero(data.calidad.sinMatchProductos)} productos · ${formatRd(data.calidad.sinMatchVenta)}`} />
        <TarjetaCalidad href={`/admin/consumo/calidad?cola=costo&dias=30`} titulo="Sin costo" detalle={`${formatNumero(data.calidad.sinCostoProductos)} productos · ${formatRd(data.calidad.sinCostoVenta)}`} />
        <TarjetaCalidad href={`/admin/consumo/calidad?cola=cuadre&${query}`} titulo="Sesiones que no cuadran" detalle={`${formatNumero(data.calidad.descuadradas)} en el periodo`} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Comparacion titulo="Semana contra semana" actual={data.tendencias.semana.actual} anterior={data.tendencias.semana.anterior} nota={`Semana del ${formatDayKey(data.tendencias.semana.desde)}`} />
        <Comparacion titulo="Mes contra mes" actual={data.tendencias.mes.actual} anterior={data.tendencias.mes.anterior} nota="Mes en curso contra el mes anterior" />
      </section>
    </div>
  );
}

function detalleMargen(data: ResumenConsumo): string {
  const partes = ["Costo último disponible. Es una estimación sobre ventas viejas."];
  if (data.kpis.cobertura != null) {
    partes.push(`${formatPct(data.kpis.cobertura).replace("+", "")} de la venta tiene costo`);
  }
  if (data.kpis.margenPct != null) {
    partes.push(`${formatPct(data.kpis.margenPct).replace("+", "")} sobre la venta cubierta sin ITBIS`);
  }
  if (data.anterior?.cobertura != null) {
    partes.push(`cobertura comparada ${formatPct(data.anterior.cobertura).replace("+", "")}`);
  }
  return partes.join(" · ");
}

function Barra({ ancho, color }: { ancho: number; color: string }) {
  if (ancho <= 0) return null;
  return <span style={{ width: `${ancho}%`, backgroundColor: color }} />;
}

function Medio({ nombre, monto }: { nombre: string; monto: number }) {
  return (
    <div>
      <dt className="text-xs text-brand-muted">{nombre}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-[#111827]">{formatRd(monto)}</dd>
    </div>
  );
}

function TarjetaCalidad({ href, titulo, detalle }: { href: string; titulo: string; detalle: string }) {
  return (
    <Link href={href} className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm hover:border-[#D1D5DB]">
      <p className="text-sm font-semibold text-[#111827]">{titulo}</p>
      <p className="mt-1 text-sm text-brand-muted">{detalle}</p>
    </Link>
  );
}

function Comparacion({ titulo, actual, anterior, nota }: { titulo: string; actual: number; anterior: number; nota: string }) {
  return (
    <article className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[#111827]">{titulo}</h2>
      <p className="mt-2 text-xl font-semibold tabular-nums text-[#111827]">{formatRd(actual)}</p>
      <div className="mt-1">
        <Delta actual={actual} anterior={anterior} />
      </div>
      <p className="mt-2 text-xs text-brand-muted">{nota}</p>
    </article>
  );
}
