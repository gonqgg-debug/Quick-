"use client";

import { useState } from "react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminField";
import type { FacturaDetalle, FacturaPregunta } from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";
import { mensajeDe, type EnviarFactura } from "@/components/admin/facturas/useFactura";
import { BotonPrincipal, Pill, Seccion, TONO, fechaHora, resultadoTono } from "@/components/admin/facturas/ui";

export function Preguntas({ factura, enviar }: { factura: FacturaDetalle; enviar: EnviarFactura }) {
  const ordenadas = [...factura.preguntas].sort((a, b) => {
    if (a.estado !== b.estado) {
      return a.estado === "abierta" ? -1 : 1;
    }
    return a.creadoEn < b.creadoEn ? -1 : 1;
  });
  const abiertas = factura.preguntas.filter((pregunta) => pregunta.estado === "abierta").length;
  return (
    <Seccion id="preguntas" titulo={`Preguntas (${factura.preguntas.length})`} extra={abiertas ? <Pill label={`${abiertas} abierta${abiertas === 1 ? "" : "s"}`} tone={TONO.naranja} /> : null}>
      {!ordenadas.length ? (
        <p className="text-sm text-brand-muted">No hay preguntas sobre esta factura.</p>
      ) : (
        <ul className="space-y-3">
          {ordenadas.map((pregunta) => (
            <Pregunta key={pregunta.id} pregunta={pregunta} enviar={enviar} />
          ))}
        </ul>
      )}
    </Seccion>
  );
}

function Pregunta({ pregunta, enviar }: { pregunta: FacturaPregunta; enviar: EnviarFactura }) {
  return (
    <li className="rounded-xl border border-[#E7EBE4] px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
          {pregunta.campo || "Documento"}
          {pregunta.lineaNumero ? ` · línea ${pregunta.lineaNumero}` : ""}
        </p>
        <Pill label={pregunta.estadoLabel} tone={pregunta.estado === "abierta" ? resultadoTono("pendiente") : resultadoTono("correcto")} />
      </div>
      <p className="mt-2 font-semibold">{pregunta.pregunta}</p>
      <p className="mt-1 text-xs text-brand-muted">
        Consultó a {pregunta.consultadoA || "alguien"} · {fechaHora(pregunta.creadoEn)}
      </p>
      {pregunta.respuesta ? (
        <div className="mt-3 rounded-xl px-3 py-2" style={{ backgroundColor: brand.paleGreen }}>
          <p>{pregunta.respuesta}</p>
          <p className="mt-1 text-xs text-brand-muted">
            {pregunta.respondidoPor || "Sin nombre"} · {fechaHora(pregunta.respondidoEn)}
          </p>
          {pregunta.evidencia ? <p className="mt-1 text-xs">{pregunta.evidencia}</p> : null}
        </div>
      ) : (
        <RespuestaForm preguntaId={pregunta.id} enviar={enviar} />
      )}
    </li>
  );
}

function RespuestaForm({ preguntaId, enviar }: { preguntaId: string; enviar: EnviarFactura }) {
  const [respuesta, setRespuesta] = useState("");
  const [respondidoPor, setRespondidoPor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await enviar(`/preguntas/${preguntaId}`, "PATCH", { respuesta, respondidoPor });
    } catch (reason) {
      setError(mensajeDe(reason, "No pudimos guardar la respuesta"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <AdminTextarea value={respuesta} onChange={(event) => setRespuesta(event.target.value)} rows={2} placeholder="Respuesta" aria-label="Respuesta" />
      <AdminInput value={respondidoPor} onChange={(event) => setRespondidoPor(event.target.value)} placeholder="Quién respondió" aria-label="Quién respondió" />
      {error ? <p className="text-sm" style={{ color: brand.error }}>{error}</p> : null}
      <BotonPrincipal disabled={saving || !respuesta.trim()} onClick={() => void submit()} color={brand.navy}>
        Guardar respuesta
      </BotonPrincipal>
    </div>
  );
}
