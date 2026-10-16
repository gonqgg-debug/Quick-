"use client";

import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DEFINICIONES, formatNumero, formatRd } from "@/lib/pos-domain";
import { formatDayKey } from "@/lib/local-day";
import { Metrica, Pildora, Vacio } from "@/components/admin/consumo/ui";
import { SerieProducto } from "@/components/admin/consumo/SerieProducto";

export function ConsumoProductoVista({
  producto,
}: {
  producto: {
    codigo: string;
    productId: string | null;
    nombre: string;
    marca: string | null;
    categoria: string;
    matchEstado: "match" | "sin_match";
    venta: number;
    unidades: number;
    ordenes: number;
    precioRealizado: number | null;
    costo: number | null;
    costoOrigen: string | null;
    costoFecha: string | null;
    margen: number | null;
    serie: Array<{ fecha: string; unidades: number; venta: number }>;
    horas: Array<{ hora: number; venta: number; unidades: number; ordenes: number }>;
  };
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{producto.categoria}</p>
        <h2 className="mt-1 text-xl font-semibold text-[#111827]">{producto.nombre}</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {producto.marca ? `${producto.marca} · ` : ""}
          {producto.codigo}
          {producto.productId ? (
            <>
              {" · "}
              <Link href={`/admin/catalogo/productos/${producto.productId}`} className="font-semibold" style={{ color: "#3F6B1C" }}>
                Ficha del catálogo
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {producto.matchEstado === "sin_match" ? (
        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
          Esta venta no está en el catálogo. El código es {producto.codigo}
          {producto.nombre ? ` y en Odoo se llama ${producto.nombre}` : ""}. Se agrega en el import del catálogo, no desde aquí.{" "}
          <Link href="/admin/catalogo/importar" className="font-semibold underline">
            Ir al import
          </Link>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica etiqueta="Venta" valor={formatRd(producto.venta)} definicion={DEFINICIONES.venta} />
        <Metrica etiqueta="Unidades" valor={formatNumero(producto.unidades, 1)} definicion="Unidades netas, con las devoluciones restadas." />
        <Metrica etiqueta="Precio realizado" valor={formatRd(producto.precioRealizado)} definicion="Venta dividida entre unidades." />
        <Metrica
          etiqueta="Margen"
          valor={producto.margen == null ? "Sin costo" : formatRd(producto.margen)}
          definicion={DEFINICIONES.margen}
        />
      </section>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#111827]">Costo vigente</h3>
        {producto.costo == null ? (
          <p className="mt-2 text-sm text-brand-muted">
            Sin costo. El margen no se inventa en cero.
            {producto.productId ? (
              <>
                {" "}
                <Link href={`/admin/catalogo/productos/${producto.productId}`} className="font-semibold" style={{ color: "#3F6B1C" }}>
                  Corregir costo
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#111827]">
            {formatRd(producto.costo)} por unidad, {producto.costoOrigen === "manual" ? "cargado a mano" : "de la última factura"}
            {producto.costoFecha ? ` el ${formatDayKey(producto.costoFecha)}` : ""}.
            {producto.productId ? (
              <>
                {" "}
                <Link href={`/admin/catalogo/productos/${producto.productId}`} className="font-semibold" style={{ color: "#3F6B1C" }}>
                  Corregir costo
                </Link>
              </>
            ) : null}
          </p>
        )}
        {producto.margen == null ? <div className="mt-3"><Pildora tono="gris">Sin costo</Pildora></div> : null}
      </section>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#111827]">Por día</h3>
        <div className="mt-4">
          {producto.serie.length === 0 ? <Vacio titulo="Sin ventas en el periodo" detalle="Este código no aparece en las sesiones de estas fechas." /> : <SerieProducto serie={producto.serie} />}
        </div>
      </section>

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#111827]">Por hora</h3>
        <p className="mt-1 text-xs text-brand-muted">Hora local de la orden, dentro del día en que se abrió la caja.</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={producto.horas}>
              <XAxis dataKey="hora" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(value: number) => [formatRd(value), "Venta"]} contentStyle={{ borderRadius: 16, borderColor: "#E5E7EB" }} />
              <Bar dataKey="venta" fill="#7EB341" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
