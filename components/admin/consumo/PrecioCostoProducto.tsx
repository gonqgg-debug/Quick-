"use client";

import Link from "next/link";
import { useState } from "react";
import { DEFINICION_COSTO, detalleEstadoCosto, dinero, estadoCosto, etiquetaEstadoCosto, textoFuenteCosto } from "@/lib/consumo-productos-ui";
import { enlaceCosto, identificadoresProducto } from "@/lib/consumo-producto-ui";
import { formatDayKey } from "@/lib/local-day";
import type { DetalleProducto } from "@/lib/pos-consumo";
import { Definicion } from "@/components/admin/consumo/ui";

export function PrecioCostoProducto({ producto, compacto = false }: { producto: DetalleProducto; compacto?: boolean }) {
  const costoEstado = estadoCosto(producto.costoOrigen, producto.costo);
  const fuente = textoFuenteCosto(producto.costoOrigen, producto.costoFecha, producto.costoRef);
  const enlace = enlaceCosto(producto.costoOrigen, producto.costoRef);
  return (
    <section className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-brand-ink">Precio y costo</h3>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Precio medio vendido</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-brand-ink">{producto.precioMedio == null ? "—" : dinero(producto.precioMedio)}</dd>
          <p className="text-xs text-brand-muted">Venta con ITBIS dividida entre unidades netas. Incluye descuentos y devoluciones ya restadas. No es el precio del catálogo.</p>
        </div>
        {producto.precioCatalogo != null ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Precio de catálogo</dt>
            <dd className="mt-0.5 tabular-nums text-brand-ink">
              {dinero(producto.precioCatalogo)}
              {producto.tasaItbis != null ? <span className="text-brand-muted"> · ITBIS {producto.tasaItbis}%</span> : null}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            Costo de referencia
            <Definicion texto={DEFINICION_COSTO} />
          </dt>
          <dd className="mt-0.5 text-brand-ink">{etiquetaEstadoCosto(costoEstado)}</dd>
          <p className="text-xs text-brand-muted">{detalleEstadoCosto(costoEstado)}</p>
          {producto.costo != null ? (
            <p className="mt-1 tabular-nums text-brand-ink">
              {dinero(producto.costo)} por unidad de venta, con ITBIS.
              {producto.costoFecha ? ` Fuente del ${formatDayKey(producto.costoFecha)}.` : ""}
            </p>
          ) : (
            <p className="mt-1 text-brand-ink">Sin costo. La utilidad y el margen quedan en —.</p>
          )}
          {fuente ? <p className="mt-1 text-xs text-brand-muted">{fuente}</p> : null}
          <p className="mt-1 text-xs text-brand-muted">Se utiliza para estimar la rentabilidad del periodo.</p>
          <p className="mt-1 text-xs text-brand-muted">
            {producto.costo == null ? "Cobertura del costo: ninguna venta de este producto." : "Cobertura del costo: toda la venta de este producto en el periodo."}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {enlace ? (
              <Link href={enlace} className="text-sm font-semibold text-brand-green">
                Ver factura de origen
              </Link>
            ) : null}
            {producto.productId ? (
              <Link href={`/admin/catalogo/productos/${producto.productId}`} className="text-sm font-semibold text-brand-green">
                Gestionar costo
              </Link>
            ) : null}
          </div>
        </div>
      </dl>
      {compacto ? null : <DatosTecnicos producto={producto} />}
    </section>
  );
}

export function DatosTecnicos({ producto }: { producto: DetalleProducto }) {
  const ids = identificadoresProducto(producto.codigo);
  return (
    <details className="mt-3 rounded-md border border-[#EEF1EE] px-3 py-2">
      <summary className="cursor-pointer text-sm font-semibold text-brand-ink">Información técnica</summary>
      <dl className="mt-2 space-y-2 text-sm">
        <Fila etiqueta="SKU" valor={ids.sku ?? "Sin SKU comercial"} />
        {producto.codigoBarras ? <Copiable etiqueta="Código de barras" valor={producto.codigoBarras} /> : <Fila etiqueta="Código de barras" valor="—" />}
        <Copiable etiqueta="Identificador externo" valor={ids.externo} />
        {producto.marca ? <Fila etiqueta="Marca" valor={producto.marca} /> : null}
        <Fila etiqueta="Categoría" valor={producto.categoria || "—"} />
        {producto.presentacion ? <Fila etiqueta="Presentación" valor={producto.presentacion} /> : null}
      </dl>
    </details>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{etiqueta}</dt>
      <dd className="mt-0.5 break-all text-sm text-brand-ink">{valor}</dd>
    </div>
  );
}

async function copiarTexto(valor: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch {
    // El navegador puede negar el portapapeles. Se intenta el método clásico.
  }
  try {
    const area = document.createElement("textarea");
    area.value = valor;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function Copiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [aviso, setAviso] = useState("");
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{etiqueta}</dt>
      <dd className="mt-0.5 flex flex-wrap items-start gap-2">
        <span className="min-w-0 break-all font-mono text-xs text-brand-ink">{valor}</span>
        <button
          type="button"
          onClick={() => {
            void copiarTexto(valor).then((ok) => {
              setAviso(ok ? "Copiado" : "No se pudo copiar");
              window.setTimeout(() => setAviso(""), 1500);
            });
          }}
          aria-live="polite"
          className="inline-flex h-8 shrink-0 items-center rounded-md border border-[#E5E7EB] px-2 text-xs font-semibold text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
        >
          {aviso || "Copiar"}
        </button>
      </dd>
    </div>
  );
}
