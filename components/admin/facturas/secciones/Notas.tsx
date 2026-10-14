"use client";

import { useState } from "react";
import { AdminTextarea } from "@/components/admin/AdminField";
import type { FacturaDetalle } from "@/lib/facturas-shared";
import { mensajeDe, type EnviarFactura } from "@/components/admin/facturas/useFactura";
import { Aviso, BotonPrincipal, Seccion, TONO } from "@/components/admin/facturas/ui";

export function Notas({ factura, enviar }: { factura: FacturaDetalle; enviar: EnviarFactura }) {
  const [observaciones, setObservaciones] = useState(factura.observaciones ?? "");
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const cambio = observaciones !== (factura.observaciones ?? "");

  async function guardar() {
    setSaving(true);
    setMensaje(null);
    try {
      await enviar("", "PATCH", { observaciones });
      setMensaje({ ok: true, texto: "Guardado." });
    } catch (reason) {
      setMensaje({ ok: false, texto: mensajeDe(reason, "No pudimos guardar") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Seccion id="notas" titulo="Notas">
      <AdminTextarea value={observaciones} onChange={(event) => setObservaciones(event.target.value)} rows={3} aria-label="Observaciones" placeholder="Observaciones sobre esta compra" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <BotonPrincipal disabled={saving || !cambio} onClick={() => void guardar()}>
          Guardar notas
        </BotonPrincipal>
        {mensaje && mensaje.ok ? <span className="text-sm text-brand-muted">{mensaje.texto}</span> : null}
      </div>
      {mensaje && !mensaje.ok ? (
        <div className="mt-2">
          <Aviso tone={TONO.rojo}>{mensaje.texto}</Aviso>
        </div>
      ) : null}
    </Seccion>
  );
}
