"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { brand } from "@/lib/theme";

const ORDENES = [
  ["venta", "Venta"],
  ["unidades", "Unidades"],
  ["margen", "Margen"],
  ["variacion", "Variación"],
] as const;

export function FiltrosProductos({
  orden,
  categoria,
  q,
  categorias,
}: {
  orden: string;
  categoria: string;
  q: string;
  categorias: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const esVariacion = orden === "variacion" || orden === "variacion_asc";
  const [busquedaCategoria, setBusquedaCategoria] = useState("");
  const categoriasVisibles = useMemo(() => {
    const q = busquedaCategoria.trim().toLowerCase();
    if (!q) return categorias;
    return categorias.filter((item) => item.toLowerCase().includes(q));
  }, [busquedaCategoria, categorias]);

  function ir(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    next.delete("cursor");
    router.push(`/admin/consumo/productos?${next.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Orden">
        {ORDENES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => ir({ orden: id })}
            className="rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            style={{
              backgroundColor: (id === "variacion" ? esVariacion : orden === id) ? "#111827" : "#F3F4F6",
              color: (id === "variacion" ? esVariacion : orden === id) ? "#FFFFFF" : brand.ink,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {esVariacion ? (
        <div className="flex gap-1.5" role="group" aria-label="Dirección de la variación">
          <Chip activo={orden === "variacion"} onClick={() => ir({ orden: "variacion" })}>
            Suben
          </Chip>
          <Chip activo={orden === "variacion_asc"} onClick={() => ir({ orden: "variacion_asc" })}>
            Caen
          </Chip>
        </div>
      ) : null}
      <label className="block max-w-xs text-xs font-medium text-brand-muted">
        Categoría
        <input
          value={busquedaCategoria}
          onChange={(event) => setBusquedaCategoria(event.target.value)}
          placeholder="Buscar categoría"
          className="mt-1 block w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
        />
        <select
          value={categoria}
          onChange={(event) => ir({ categoria: event.target.value || null })}
          className="mt-1 block w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
        >
          <option value="">Todas</option>
          {categoriasVisibles.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <form
        className="max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          ir({ q: String(data.get("q") ?? "") });
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar producto"
          className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
        />
      </form>
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
      style={{ backgroundColor: activo ? brand.paleGreen : "#F3F4F6", color: brand.ink }}
    >
      {children}
    </button>
  );
}
