"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ETIQUETA_ESTADO_PROPUESTA, ETIQUETA_ESTADO_PRUEBA } from "@/lib/promo-presentacion";
import { brand } from "@/lib/theme";

type Fila = Record<string, unknown>;

export function PropuestasRelacionadas({ productoId, hallazgoId }: { productoId?: string; hallazgoId?: string }) {
  const [estado, setEstado] = useState<"cargando" | "listo" | "error" | "migracion">("cargando");
  const [filas, setFilas] = useState<Fila[]>([]);

  useEffect(() => {
    const consulta = productoId ? `producto=${encodeURIComponent(productoId)}` : `hallazgo=${encodeURIComponent(hallazgoId ?? "")}`;
    let activo = true;
    fetch(`/api/admin/miles/propuestas?${consulta}`)
      .then(async (respuesta) => {
        const json = await respuesta.json().catch(() => ({}));
        if (!activo) return;
        if (respuesta.status === 503) {
          setEstado("migracion");
          return;
        }
        if (!respuesta.ok) {
          setEstado("error");
          return;
        }
        setFilas(Array.isArray(json.propuestas) ? json.propuestas : []);
        setEstado("listo");
      })
      .catch(() => {
        if (activo) setEstado("error");
      });
    return () => {
      activo = false;
    };
  }, [productoId, hallazgoId]);

  if (estado === "cargando") return <p className="text-sm text-brand-muted">Cargando propuestas…</p>;
  if (estado === "migracion") return <p className="text-sm text-brand-muted">Las propuestas todavía no están disponibles en este entorno.</p>;
  if (estado === "error") return <p className="text-sm" style={{ color: brand.error }}>No pudimos cargar las propuestas relacionadas.</p>;
  return (
    <div className="space-y-3">
      {filas.length === 0 ? <p className="text-sm text-brand-muted">No hay propuestas relacionadas.</p> : null}
      <ul className="space-y-2">
        {filas.map((row) => {
          const pruebas = Array.isArray(row.pruebas) ? (row.pruebas as Fila[]) : [];
          return (
            <li key={String(row.id)} className="rounded-lg border border-[#E5E7EB] px-3 py-2">
              <Link href={`/admin/consumo/miles/propuestas/${row.id}`} className="text-sm font-semibold" style={{ color: brand.green }}>
                {String(row.nombre)}
              </Link>
              <p className="text-xs text-brand-muted">{ETIQUETA_ESTADO_PROPUESTA[String(row.estado)] ?? String(row.estado)}</p>
              {pruebas.length > 0 ? (
                <ul className="mt-1 text-xs text-brand-muted">
                  {pruebas.map((prueba) => (
                    <li key={String(prueba.id)}>Prueba {ETIQUETA_ESTADO_PRUEBA[String(prueba.estado)] ?? String(prueba.estado)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Link href="/admin/consumo/miles?seccion=propuestas" className="inline-flex rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">
        Ver propuestas publicadas
      </Link>
    </div>
  );
}
