"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EvidenciaMiles } from "@/lib/miles-domain";
import { brand } from "@/lib/theme";
import { Pildora, Vacio } from "@/components/admin/consumo/ui";

type Fila = Record<string, unknown>;

export function MilesVista({
  vista,
  filtros,
  hallazgos,
  investigaciones,
  pruebas,
  credencial,
  ultima,
  recomendaciones,
}: {
  vista: string;
  filtros: { tipo: string; estado: string; prioridad: string; desde: string; hasta: string };
  hallazgos: Fila[];
  investigaciones: Fila[];
  pruebas: Fila[];
  credencial: { id: string; prefijo: string; creadoEn: string } | null;
  ultima: Fila | null;
  recomendaciones: number;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function ir(patch: Record<string, string | null>) {
    const next = new URLSearchParams();
    const actual = { vista, ...filtros };
    for (const [key, value] of Object.entries({ ...actual, ...patch })) {
      if (value) next.set(key, value);
    }
    router.push(`/admin/consumo/miles?${next.toString()}`);
  }

  async function emitir() {
    setError(null);
    const respuesta = await fetch("/api/admin/miles/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? "No pudimos emitir el token");
      return;
    }
    setToken(cuerpo.token);
    router.refresh();
  }

  const nuevos = hallazgos.filter((row) => String(row.estado) === "vigente").length;
  const pendientes = investigaciones.filter((row) => String(row.estado) === "pendiente").length;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-4">
        <Dato etiqueta="Último análisis" valor={ultima?.terminada_en ? String(ultima.terminada_en).slice(0, 16).replace("T", " ") : "Ninguno"} />
        <Dato etiqueta="Datos hasta" valor={ultima?.datos_hasta ? String(ultima.datos_hasta) : "—"} />
        <Dato etiqueta="Hallazgos vigentes" valor={String(nuevos)} />
        <Dato etiqueta="Recomendaciones y ampliaciones" valor={`${recomendaciones} recomendaciones · ${pendientes} pendientes`} />
      </section>
      <p className="text-sm text-brand-muted">Estado de la última ejecución: {ultima ? String(ultima.estado) : "sin ejecuciones"}.</p>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["hallazgos", "Hallazgos"],
            ["pruebas", "Acciones y pruebas"],
            ["investigaciones", "Investigaciones"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => ir({ vista: id })} className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: vista === id ? brand.green : "#F3F4F6", color: vista === id ? "#fff" : brand.ink }}>
            {label}
          </button>
        ))}
      </div>

      {vista === "hallazgos" ? (
        <Hallazgos filtros={filtros} hallazgos={hallazgos} ir={ir} />
      ) : null}
      {vista === "pruebas" ? <Pruebas pruebas={pruebas} /> : null}
      {vista === "investigaciones" ? <Investigaciones investigaciones={investigaciones} /> : null}

      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Credencial de Miles</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {credencial ? `Hay un token activo que empieza por ${credencial.prefijo}. El secreto no se vuelve a mostrar.` : "Todavía no hay token. Emitirlo no reutiliza el de otro agente."}
        </p>
        <button type="button" onClick={emitir} className="mt-3 rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>
          {credencial ? "Rotar token" : "Emitir token"}
        </button>
        {token ? (
          <p className="mt-3 break-all rounded-md bg-[#F8FAF7] p-3 text-sm">
            Cópialo ahora. No queda guardado en claro: {token}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm" style={{ color: brand.error }}>{error}</p> : null}
      </section>
    </div>
  );
}

function Hallazgos({
  filtros,
  hallazgos,
  ir,
}: {
  filtros: { tipo: string; estado: string; prioridad: string; desde: string; hasta: string };
  hallazgos: Fila[];
  ir: (patch: Record<string, string | null>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select label="Tipo" value={filtros.tipo} onChange={(value) => ir({ tipo: value })} opciones={["", "oportunidad", "deterioro", "patron", "anomalia", "calidad"]} />
        <Select label="Estado" value={filtros.estado} onChange={(value) => ir({ estado: value })} opciones={["", "vigente", "descartado", "archivado"]} />
        <Select label="Prioridad" value={filtros.prioridad} onChange={(value) => ir({ prioridad: value })} opciones={["", "alta", "media", "baja"]} />
        <label className="text-xs text-brand-muted">Desde<input type="date" value={filtros.desde} onChange={(event) => ir({ desde: event.target.value || null })} className="mt-1 block rounded-md border px-2 py-1 text-sm" /></label>
        <label className="text-xs text-brand-muted">Hasta<input type="date" value={filtros.hasta} onChange={(event) => ir({ hasta: event.target.value || null })} className="mt-1 block rounded-md border px-2 py-1 text-sm" /></label>
      </div>
      {hallazgos.length === 0 ? <Vacio titulo="Miles todavía no ha publicado análisis" detalle="Cuando publique por la API, los hallazgos aparecen aquí. No hay ejemplos cargados." /> : null}
      {hallazgos.map((row) => (
        <article key={String(row.id)} className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Pildora tono="gris">{String(row.tipo)}</Pildora>
            <Pildora tono={row.prioridad === "alta" ? "naranja" : "verde"}>{String(row.prioridad)}</Pildora>
            <Pildora tono="gris">{String(row.estado)}</Pildora>
          </div>
          <h3 className="mt-2 text-base font-semibold">{String(row.titulo)}</h3>
          <p className="mt-2 text-sm">{String(row.observacion)}</p>
          {row.interpretacion ? <p className="mt-2 text-sm text-brand-muted">Hipótesis: {String(row.interpretacion)}</p> : null}
          {row.recomendacion ? <p className="mt-2 text-sm">Recomendación: {String(row.recomendacion)}</p> : null}
          {row.limitaciones ? <p className="mt-2 text-xs text-brand-muted">Limitación: {String(row.limitaciones)}</p> : null}
          <p className="mt-2 text-xs text-brand-muted">
            {String(row.tienda)} · {String(row.periodo_desde)} a {String(row.periodo_hasta)} · publicado {String(row.publicado_en).slice(0, 16).replace("T", " ")}
          </p>
          <p className="mt-1 text-xs text-brand-muted">Prioridad: {String(row.prioridad_justificacion)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/admin/consumo/miles/${row.id}`} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>Ver evidencia</Link>
            <EvidenciaLinks evidencia={row.evidencia as EvidenciaMiles} />
          </div>
        </article>
      ))}
    </div>
  );
}

function EvidenciaLinks({ evidencia }: { evidencia: EvidenciaMiles | null }) {
  if (!evidencia?.enlaces) return null;
  return (
    <>
      {evidencia.enlaces.map((enlace) => (
        <Link key={`${enlace.pantalla}-${enlace.query}`} href={hrefDe(enlace.pantalla, enlace.query)} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
          Abrir {enlace.pantalla}
        </Link>
      ))}
    </>
  );
}

function Pruebas({ pruebas }: { pruebas: Fila[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ hipotesis: "", accion: "", metricaPrincipal: "", responsable: "" });
  async function crear(event: React.FormEvent) {
    event.preventDefault();
    await fetch("/api/admin/miles/pruebas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.refresh();
  }
  async function mover(id: string, version: number, estado: string) {
    await fetch(`/api/admin/miles/pruebas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, estado }) });
    router.refresh();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={crear} className="grid gap-2 rounded-lg border border-[#E5E7EB] bg-white p-4 md:grid-cols-2">
        <input required placeholder="Hipótesis" value={form.hipotesis} onChange={(event) => setForm({ ...form, hipotesis: event.target.value })} className="rounded-md border px-3 py-2 text-sm" />
        <input required placeholder="Acción concreta" value={form.accion} onChange={(event) => setForm({ ...form, accion: event.target.value })} className="rounded-md border px-3 py-2 text-sm" />
        <input required placeholder="Métrica principal" value={form.metricaPrincipal} onChange={(event) => setForm({ ...form, metricaPrincipal: event.target.value })} className="rounded-md border px-3 py-2 text-sm" />
        <input placeholder="Responsable" value={form.responsable} onChange={(event) => setForm({ ...form, responsable: event.target.value })} className="rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-full px-3 py-1.5 text-sm font-semibold text-white md:col-span-2" style={{ backgroundColor: brand.green }}>Crear propuesta</button>
        <p className="text-xs text-brand-muted md:col-span-2">Aprobar no cambia precios, promociones, inventario ni pedidos.</p>
      </form>
      {pruebas.length === 0 ? <Vacio titulo="No hay pruebas" detalle="Una recomendación se convierte en propuesta. Miles evalúa; la decisión queda de este lado." /> : null}
      {pruebas.map((row) => (
        <article key={String(row.id)} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <p className="text-sm font-semibold">{String(row.accion)}</p>
          <p className="mt-1 text-sm text-brand-muted">{String(row.hipotesis)}</p>
          <p className="mt-1 text-xs text-brand-muted">Estado {String(row.estado)} · métrica {String(row.metrica_principal)}{row.responsable ? ` · ${row.responsable}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {siguiente(String(row.estado)).map((estado) => (
              <button key={estado} type="button" onClick={() => mover(String(row.id), Number(row.version), estado)} className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold">
                {estado}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function siguiente(estado: string): string[] {
  if (estado === "propuesta") return ["aprobada", "cancelada"];
  if (estado === "aprobada") return ["en_curso", "cancelada"];
  if (estado === "en_curso") return ["pendiente_evaluacion", "cancelada"];
  if (estado === "pendiente_evaluacion") return ["finalizada", "cancelada"];
  return [];
}

function Investigaciones({ investigaciones }: { investigaciones: Fila[] }) {
  const router = useRouter();
  const [pregunta, setPregunta] = useState("");
  async function crear(event: React.FormEvent) {
    event.preventDefault();
    await fetch("/api/admin/miles/investigaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta }) });
    setPregunta("");
    router.refresh();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={crear} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <textarea value={pregunta} onChange={(event) => setPregunta(event.target.value)} placeholder="Investiga por qué cayó la venta de cerveza durante las últimas cuatro semanas" className="min-h-24 w-full rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="mt-2 rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>Pedir investigación</button>
        <p className="mt-2 text-xs text-brand-muted">Queda pendiente hasta que Miles la tome por la API. Pedirla no avisa al bot por otro canal.</p>
      </form>
      {investigaciones.length === 0 ? <Vacio titulo="No hay investigaciones" detalle="Las preguntas y las ampliaciones de un hallazgo se listan aquí." /> : null}
      {investigaciones.map((row) => (
        <article key={String(row.id)} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <p className="text-sm font-semibold">{String(row.pregunta)}</p>
          <p className="mt-1 text-xs text-brand-muted">{String(row.tipo)} · {String(row.estado)} · {String(row.solicitante)} · {String(row.creada_en).slice(0, 10)}</p>
          {row.respuesta ? <p className="mt-2 text-sm">{String(row.respuesta)}</p> : null}
          {row.estado === "pendiente" ? <p className="mt-1 text-xs text-brand-muted">Pendiente. Miles todavía no la ha tomado.</p> : null}
        </article>
      ))}
    </div>
  );
}

function hrefDe(pantalla: string, query: string): string {
  const base = pantalla === "productos" ? "/admin/consumo/productos" : pantalla === "horarios" ? "/admin/consumo/horarios" : pantalla === "canasta" ? "/admin/consumo/canasta" : "/admin/consumo";
  return query ? `${base}?${query}` : base;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <article className="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{etiqueta}</p>
      <p className="mt-2 text-sm font-semibold text-[#111827]">{valor}</p>
    </article>
  );
}

function Select({ label, value, onChange, opciones }: { label: string; value: string; onChange: (value: string | null) => void; opciones: string[] }) {
  return (
    <label className="text-xs text-brand-muted">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value || null)} className="mt-1 block rounded-md border px-2 py-1 text-sm text-brand-ink">
        {opciones.map((opcion) => (
          <option key={opcion || "todas"} value={opcion}>{opcion || "Todas"}</option>
        ))}
      </select>
    </label>
  );
}
