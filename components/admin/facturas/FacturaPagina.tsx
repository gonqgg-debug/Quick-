"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { brand } from "@/lib/theme";
import { DocumentoVisor } from "@/components/admin/facturas/DocumentoVisor";
import { FacturaEncabezado } from "@/components/admin/facturas/FacturaEncabezado";
import { SECCIONES, pendientesDe } from "@/components/admin/facturas/falta";
import { leerLista, urlDeLista, type ListaGuardada } from "@/components/admin/facturas/lista-guardada";
import { Datos } from "@/components/admin/facturas/secciones/Datos";
import { Equipo } from "@/components/admin/facturas/secciones/Equipo";
import { Notas } from "@/components/admin/facturas/secciones/Notas";
import { Preguntas } from "@/components/admin/facturas/secciones/Preguntas";
import { Productos } from "@/components/admin/facturas/secciones/Productos";
import { Validaciones } from "@/components/admin/facturas/secciones/Validaciones";
import { TONO, fechaHora } from "@/components/admin/facturas/ui";
import { useFactura } from "@/components/admin/facturas/useFactura";

function escribiendo(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function FacturaPagina({ id }: { id: string }) {
  const router = useRouter();
  const { factura, error, loading, enviar } = useFactura(id);
  const [lista, setLista] = useState<ListaGuardada | null>(null);

  useEffect(() => {
    setLista(leerLista());
  }, []);

  const nav = useMemo(() => {
    const ids = lista?.ids ?? [];
    const actual = factura?.id ?? id;
    const index = ids.indexOf(actual);
    return {
      anterior: index > 0 ? ids[index - 1] : null,
      siguiente: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null,
      posicion: index >= 0 ? index + 1 : null,
      total: ids.length,
      volver: urlDeLista(lista?.query ?? ""),
    };
  }, [lista, factura?.id, id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || escribiendo(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "j" && nav.siguiente) {
        event.preventDefault();
        router.push(`/admin/facturas/${nav.siguiente}`);
      } else if (key === "k" && nav.anterior) {
        event.preventDefault();
        router.push(`/admin/facturas/${nav.anterior}`);
      } else if (event.key === "Escape") {
        router.push(nav.volver);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, router]);

  useEffect(() => {
    for (const vecino of [nav.anterior, nav.siguiente]) {
      if (vecino) {
        router.prefetch(`/admin/facturas/${vecino}`);
      }
    }
  }, [nav.anterior, nav.siguiente, router]);

  if (loading && !factura) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-96 animate-pulse rounded-2xl bg-[#F3F4F6]" />
          <div className="h-96 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        </div>
      </div>
    );
  }

  if (!factura) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E7EBE4] px-6 py-16 text-center">
        <p className="font-display text-lg font-bold">No pudimos abrir la factura</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">{error ?? "Puede que ya no exista."}</p>
        <Link href={nav.volver} className="mt-4 inline-block text-sm font-bold" style={{ color: brand.blue }}>
          Volver a facturas
        </Link>
      </div>
    );
  }

  const pendientes = pendientesDe(factura, fechaHora);

  return (
    <div key={factura.id} className="space-y-4">
      <FacturaEncabezado factura={factura} enviar={enviar} nav={nav} />

      {pendientes.length ? (
        <section className="rounded-2xl border px-4 py-3" style={{ borderColor: "#FECACA", backgroundColor: "#FFF7F7" }} aria-label="Lo que falta">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#991B1B" }}>
            Lo que falta
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {pendientes.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.grave ? "#DC2626" : "#F59E0B" }} aria-hidden="true" />
                <a href={`#${item.seccion}`} className="hover:underline">
                  {item.texto}
                </a>
                {item.dueno ? <span className="shrink-0 text-xs capitalize text-brand-muted">{item.dueno}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="lg:sticky lg:top-0 lg:h-[calc(100vh-3rem)]">
          <DocumentoVisor factura={factura} />
        </div>
        <div className="min-w-0 space-y-4">
          <nav className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl bg-white/95 px-1 py-1.5 backdrop-blur" aria-label="Secciones de la factura">
            {SECCIONES.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-brand-muted hover:bg-[#F3F4F6] hover:text-brand-ink">
                {item.label}
                {item.id === "preguntas" && factura.preguntasAbiertas > 0 ? (
                  <span className="ml-1 rounded-full px-1.5" style={TONO.naranja}>
                    {factura.preguntasAbiertas}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
          <Datos factura={factura} />
          <Productos factura={factura} enviar={enviar} />
          <Equipo factura={factura} enviar={enviar} />
          <Validaciones factura={factura} />
          <Preguntas factura={factura} enviar={enviar} />
          <Notas factura={factura} enviar={enviar} />
        </div>
      </div>
    </div>
  );
}
