"use client";

import { useState } from "react";
import type { FacturaDetalle } from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";
import { Pill, Seccion, TONO, fechaHora, resultadoTono } from "@/components/admin/facturas/ui";

export function Validaciones({ factura }: { factura: FacturaDetalle }) {
  const conDiferencia = factura.validaciones.filter((validacion) => validacion.resultado === "diferencia").length;
  const pendientes = factura.validaciones.filter((validacion) => validacion.resultado === "pendiente").length;
  const todoBien = conDiferencia === 0 && pendientes === 0;
  const [abiertas, setAbiertas] = useState(!todoBien);

  const resumen = !factura.validaciones.length ? null : todoBien ? (
    <Pill label="Todo correcto" tone={TONO.verde} />
  ) : (
    <span className="flex gap-1">
      {conDiferencia ? <Pill label={`${conDiferencia} con diferencia`} tone={TONO.rojo} /> : null}
      {pendientes ? <Pill label={`${pendientes} pendiente${pendientes === 1 ? "" : "s"}`} tone={TONO.naranja} /> : null}
    </span>
  );

  return (
    <Seccion id="validaciones" titulo={`Validaciones (${factura.validaciones.length})`} extra={resumen}>
      {!factura.validaciones.length ? (
        <p className="text-sm text-brand-muted">Phillip todavía no publicó validaciones.</p>
      ) : (
        <>
          <button type="button" className="text-sm font-bold" style={{ color: brand.blue }} onClick={() => setAbiertas((current) => !current)} aria-expanded={abiertas}>
            {abiertas ? "Ocultar detalle" : "Ver detalle"}
          </button>
          {abiertas ? (
            <ul className="mt-3 divide-y divide-[#F1F5F9] rounded-xl border border-[#E7EBE4]">
              {[...factura.validaciones]
                .sort((a, b) => orden(a.resultado) - orden(b.resultado))
                .map((validacion) => (
                  <li key={validacion.codigo} className="px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{validacion.codigoLabel}</p>
                      <Pill label={validacion.resultadoLabel} tone={resultadoTono(validacion.resultado)} />
                    </div>
                    {validacion.explicacion ? <p className="mt-1 text-brand-muted">{validacion.explicacion}</p> : null}
                    <p className="mt-1 text-xs text-brand-muted">{validacion.revisadoEn ? fechaHora(validacion.revisadoEn) : "Sin fecha de revisión"}</p>
                  </li>
                ))}
            </ul>
          ) : null}
        </>
      )}
    </Seccion>
  );
}

function orden(resultado: FacturaDetalle["validaciones"][number]["resultado"]): number {
  return resultado === "diferencia" ? 0 : resultado === "pendiente" ? 1 : resultado === "correcto" ? 2 : 3;
}
