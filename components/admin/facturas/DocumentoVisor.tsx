"use client";

import { useEffect, useState } from "react";
import type { FacturaDetalle } from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";

function resumenDocumentos(documentos: FacturaDetalle["documentos"]): string {
  const tickets = documentos.filter((doc) => doc.tipo === "ticket").length;
  const paginas = documentos.length - tickets;
  const partes = [];
  if (paginas) {
    partes.push(paginas === 1 ? "1 página" : `${paginas} páginas`);
  }
  if (tickets) {
    partes.push(tickets === 1 ? "ticket" : `${tickets} tickets`);
  }
  return partes.join(" y ");
}

export function DocumentoVisor({ factura }: { factura: FacturaDetalle }) {
  const documentos = factura.documentos;
  const [indice, setIndice] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [abiertoMovil, setAbiertoMovil] = useState(false);

  useEffect(() => {
    setIndice(0);
    setZoom(false);
  }, [factura.id]);

  const actual = documentos[Math.min(indice, documentos.length - 1)];
  const src = actual ? `/api/admin/facturas/${factura.id}/documentos/${actual.id}` : null;
  const etiqueta = (doc: (typeof documentos)[number], i: number) =>
    doc.tipo === "ticket" ? "Ticket" : doc.nombre || (doc.pagina ? `Página ${doc.pagina}` : `Página ${i + 1}`);

  return (
    <div id="documento" className="flex h-full min-h-0 flex-col rounded-2xl border border-[#E7EBE4] bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-[#E7EBE4] px-3 py-2">
        <button
          type="button"
          className="text-sm font-semibold lg:pointer-events-none"
          onClick={() => setAbiertoMovil((current) => !current)}
          aria-expanded={abiertoMovil}
        >
          Documento original
          <span className="ml-1 text-brand-muted">
            {documentos.length ? `· ${resumenDocumentos(documentos)}` : "· sin foto"}
          </span>
          <span className="ml-2 text-xs font-bold lg:hidden" style={{ color: brand.blue }}>
            {abiertoMovil ? "Ocultar" : "Ver"}
          </span>
        </button>
        {src ? (
          <div className="flex shrink-0 items-center gap-3 text-sm font-bold">
            {actual?.esImagen ? (
              <button type="button" onClick={() => setZoom((current) => !current)} style={{ color: brand.blue }} aria-pressed={zoom}>
                {zoom ? "Ajustar" : "Ampliar"}
              </button>
            ) : null}
            <a href={src} target="_blank" rel="noreferrer" style={{ color: brand.blue }}>
              Abrir aparte
            </a>
          </div>
        ) : null}
      </div>

      <div className={`${abiertoMovil ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
        {!actual || !src ? (
          <div className="flex min-h-[240px] flex-1 items-center justify-center px-6 text-center text-sm text-brand-muted">
            Todavía no está la foto ni el PDF de esta factura. Rodrigo o Phillip la suben con la ficha.
          </div>
        ) : actual.esImagen ? (
          <div className={`min-h-[320px] flex-1 bg-[#F7F8F6] ${zoom ? "overflow-auto" : "overflow-hidden"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={etiqueta(actual, indice)}
              onClick={() => setZoom((current) => !current)}
              className={zoom ? "max-w-none cursor-zoom-out" : "h-full w-full cursor-zoom-in object-contain"}
              style={zoom ? { width: "200%" } : undefined}
            />
          </div>
        ) : (
          <iframe title={etiqueta(actual, indice)} src={src} className="min-h-[480px] w-full flex-1 bg-[#F7F8F6]" />
        )}

        {documentos.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-t border-[#E7EBE4] p-2">
            {documentos.map((doc, i) => {
              const activo = i === indice;
              const thumb = `/api/admin/facturas/${factura.id}/documentos/${doc.id}`;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    setIndice(i);
                    setZoom(false);
                  }}
                  className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-[#F7F8F6] text-[10px] font-bold text-brand-muted"
                  style={{ borderColor: activo ? brand.green : "#E7EBE4" }}
                  aria-label={etiqueta(doc, i)}
                  aria-current={activo}
                >
                  {doc.esImagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "PDF"
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
