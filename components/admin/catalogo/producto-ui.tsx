"use client";

import { useEffect, useRef } from "react";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import {
  isUncategorized,
  margenBajo,
  formatoMargen,
  shortOdooCode,
  type AdminCatalogProduct,
  type AdminCatalogProveedor,
} from "@/lib/admin-catalog-products-shared";
import { Pill, TONO } from "@/components/admin/facturas/ui";

export function lineaSecundaria(product: Pick<AdminCatalogProduct, "marca" | "categoria" | "codigoOdoo" | "codigoBarras">): string {
  return [
    product.marca,
    isUncategorized(product.categoria) ? "Sin categoría" : product.categoria,
    product.codigoOdoo ? shortOdooCode(product.codigoOdoo) : null,
    product.codigoBarras,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function textoCosto(costo: number | null): string {
  return costo == null ? "Sin costo" : formatPrice(costo);
}

export function FotoProducto({ src, size }: { src: string | null; size: "lista" | "bloque" | "ficha" }) {
  const box =
    size === "lista" ? "h-10 w-10 rounded-lg" : size === "bloque" ? "h-36 w-full rounded-xl" : "h-28 w-28 rounded-2xl";
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-[#F7F8F6] ${box}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="text-xs text-brand-muted">Sin foto</span>
      )}
    </div>
  );
}

export function MargenProducto({ margen }: { margen: number | null }) {
  if (margen == null) {
    return <span className="text-sm text-brand-muted">Sin costo</span>;
  }
  return <Pill label={formatoMargen(margen)} tone={margenBajo(margen) ? TONO.naranja : TONO.verde} />;
}

export function EstadoProducto({ activo }: { activo: boolean }) {
  return <Pill label={activo ? "Activo" : "Inactivo"} tone={activo ? TONO.verde : TONO.gris} />;
}

export function ProveedoresProducto({ proveedores }: { proveedores: AdminCatalogProveedor[] }) {
  if (proveedores.length === 0) {
    return <span className="text-sm text-brand-muted">Sin proveedor</span>;
  }
  const visibles = proveedores.slice(0, 2);
  const resto = proveedores.length - visibles.length;
  return (
    <span className="flex flex-wrap gap-1">
      {visibles.map((item) => (
        <Pill key={item.id} label={item.nombre} tone={TONO.gris} title={item.ultimaCompra ? `Última compra ${item.ultimaCompra}` : undefined} />
      ))}
      {resto > 0 ? <Pill label={`+${resto}`} tone={TONO.gris} title={proveedores.slice(2).map((item) => item.nombre).join(", ")} /> : null}
    </span>
  );
}

export function BrandCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  const on = checked || indeterminate;
  return (
    <label className="inline-flex cursor-pointer items-center" onClick={(event) => event.stopPropagation()}>
      <input ref={ref} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} className="sr-only" />
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border"
        style={{
          borderColor: on ? brand.green : "#D1D5DB",
          backgroundColor: on ? brand.green : "#FFFFFF",
        }}
      >
        {checked ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5.2 4.1 7.3 8 2.8" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : indeterminate ? (
          <span className="block h-0.5 w-2.5 rounded-full bg-white" />
        ) : null}
      </span>
    </label>
  );
}
