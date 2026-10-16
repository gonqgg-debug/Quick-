"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { brand } from "@/lib/theme";

export function MilesDetalleAcciones({ id, version, estado }: { id: string; version: number; estado: string }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(body: Record<string, unknown>) {
    const respuesta = await fetch(`/api/admin/miles/hallazgos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, ...body }),
    });
    const json = await respuesta.json();
    setAviso(json.aviso ?? json.error ?? "Listo");
    router.refresh();
  }

  if (estado !== "vigente") {
    return <p className="text-sm text-brand-muted">Este hallazgo está {estado}.</p>;
  }

  return (
    <section className="space-y-3 rounded-lg border border-[#E5E7EB] bg-white p-5">
      <h3 className="text-sm font-semibold">Acciones</h3>
      <label className="block text-xs text-brand-muted">
        Pedir ampliación
        <textarea value={pregunta} onChange={(event) => setPregunta(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
      </label>
      <button type="button" onClick={() => enviar({ accion: "ampliacion", pregunta })} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">Dejar la solicitud</button>
      <label className="block text-xs text-brand-muted">
        Motivo para descartar
        <input value={motivo} onChange={(event) => setMotivo(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => enviar({ accion: "descartar", motivo })} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.error }}>Descartar</button>
        <button type="button" onClick={() => enviar({ accion: "archivar" })} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">Archivar</button>
        <button type="button" onClick={() => router.push(`/admin/consumo/miles?vista=pruebas`)} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">Crear prueba</button>
      </div>
      {aviso ? <p className="text-sm text-brand-muted">{aviso}</p> : null}
    </section>
  );
}
