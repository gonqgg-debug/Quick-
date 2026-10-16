"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { MilesFicha, enlacePrincipal, etiquetaClase, etiquetaTipo, hrefExplorar, visualDe } from "@/components/admin/consumo/MilesFicha";
import { MilesVisual, textoComparacion, textoMetrica } from "@/components/admin/consumo/MilesVisual";
import { Pildora, Vacio } from "@/components/admin/consumo/ui";
import { formatoDiaComercial, formatoInstante, graficoAlcanza, esPorRevisar, esResuelto } from "@/lib/miles-presentacion";
import type { FrescuraConsumo } from "@/lib/pos-consumo";
import { brand } from "@/lib/theme";

type Fila = Record<string, unknown>;

type Filtros = { tipo: string; estado: string; prioridad: string; desde: string; hasta: string; q: string; rapido: string };

const RAPIDOS = [
  ["revisar", "Por revisar"],
  ["oportunidades", "Oportunidades"],
  ["cambios", "Cambios relevantes"],
  ["calidad", "Calidad de datos"],
  ["todos", "Todos"],
] as const;

export function MilesVista({
  vista,
  filtros,
  hallazgos,
  investigaciones,
  pruebas,
  ejecuciones,
  credencial,
  ultima,
  frescura,
  detalle,
  origen,
}: {
  vista: string;
  filtros: Filtros;
  hallazgos: Fila[];
  investigaciones: Fila[];
  pruebas: Fila[];
  ejecuciones: Fila[];
  credencial: { id: string; prefijo: string; creadoEn: string } | null;
  ultima: Fila | null;
  frescura: FrescuraConsumo | null;
  detalle: { hallazgo: Fila; eventos: Fila[]; comentarios: Fila[]; investigaciones: Fila[] } | null;
  origen: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pedir, setPedir] = useState(vista === "investigaciones" && filtros.q === "");
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const irRef = useRef(ir);
  irRef.current = ir;
  const tituloPanel = useId();

  function ir(patch: Record<string, string | null>) {
    const next = new URLSearchParams();
    const actual = { vista, ...filtros, hallazgo: detalle ? String(detalle.hallazgo.id) : "", origen };
    for (const [key, value] of Object.entries({ ...actual, ...patch })) {
      if (value) next.set(key, value);
    }
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function aplicarIndicador(patch: Record<string, string | null>) {
    ir({
      q: null,
      tipo: null,
      estado: null,
      prioridad: null,
      desde: null,
      hasta: null,
      rapido: null,
      origen: null,
      hallazgo: null,
      ...patch,
    });
  }

  useEffect(() => {
    if (!detalle) return;
    const antes = document.activeElement as HTMLElement | null;
    cerrarRef.current?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        irRef.current({ hallazgo: null });
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodos = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button,input,textarea,select,[tabindex]")).filter((nodo) => !nodo.hasAttribute("disabled") && nodo.tabIndex >= 0);
      const primero = nodos[0];
      const ultimo = nodos[nodos.length - 1];
      if (!primero || !ultimo) return;
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus({ preventScroll: true });
      }
    }
    document.addEventListener("keydown", onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
      antes?.focus({ preventScroll: true });
    };
  }, [detalle?.hallazgo.id]);

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

  const porRevisar = hallazgos.filter((row) => esPorRevisar(row)).length;
  const oportunidades = hallazgos.filter((row) => String(row.tipo) === "oportunidad" && !esResuelto(row)).length;
  const enCurso = pruebas.filter((row) => String(row.estado) === "en_curso").length;
  const resueltos = hallazgos.filter((row) => esResuelto(row)).length;
  const estadoEjecucion = ultima ? String(ultima.estado) : "sin ejecuciones";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#111827]">Miles</h1>
          <p className="mt-1 text-sm text-brand-muted">Qué está cambiando en Quick! y dónde actuar.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-xs text-brand-muted">
            {frescura?.ultimaFecha ? `Datos al ${formatoDiaComercial(frescura.ultimaFecha)}` : "Sin fecha de datos"}
            {" · "}
            {ultima?.terminada_en ? `Ejecución ${estadoEjecucion}, ${formatoInstante(ultima.terminada_en)}` : `Ejecución ${estadoEjecucion}`}
            {frescura?.faltaAyer ? " · Falta la caja de ayer" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setPedir(true); ir({ vista: "investigaciones", hallazgo: null }); }} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>
              Pedir investigación
            </button>
            <button type="button" onClick={() => ir({ vista: "actividad", hallazgo: null })} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">
              Actividad
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Indicador etiqueta="Por revisar" valor={porRevisar} activo={vista === "hallazgos" && filtros.rapido === "revisar"} onClick={() => aplicarIndicador({ vista: "hallazgos", rapido: "revisar" })} />
        <Indicador etiqueta="Oportunidades" valor={oportunidades} activo={vista === "hallazgos" && filtros.rapido === "oportunidades"} onClick={() => aplicarIndicador({ vista: "hallazgos", rapido: "oportunidades" })} />
        <Indicador etiqueta="Pruebas en curso" valor={enCurso} activo={vista === "pruebas" && filtros.estado === "en_curso"} onClick={() => aplicarIndicador({ vista: "pruebas", estado: "en_curso" })} />
        <Indicador etiqueta="Resueltos" valor={resueltos} activo={vista === "hallazgos" && filtros.rapido === "resueltos"} onClick={() => aplicarIndicador({ vista: "hallazgos", rapido: "resueltos" })} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["hallazgos", "Hallazgos"],
            ["pruebas", "Acciones y pruebas"],
            ["investigaciones", "Investigaciones"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => ir({ vista: id, hallazgo: null })} className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: vista === id ? brand.green : "#F3F4F6", color: vista === id ? "#fff" : brand.ink }}>
            {label}
          </button>
        ))}
      </div>
      {pending ? <p className="text-xs text-brand-muted" role="status">Cargando…</p> : null}

      {vista === "hallazgos" ? <Hallazgos filtros={filtros} hallazgos={hallazgos} ir={ir} seleccionado={detalle ? String(detalle.hallazgo.id) : ""} /> : null}
      {vista === "pruebas" ? <Pruebas pruebas={pruebas} origen={origen} estado={filtros.estado} ir={ir} /> : null}
      {vista === "investigaciones" ? <Investigaciones investigaciones={investigaciones} hallazgos={hallazgos} pedir={pedir} /> : null}
      {vista === "actividad" ? <Actividad ejecuciones={ejecuciones} credencial={credencial} token={token} error={error} emitir={emitir} /> : null}

      {detalle ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={(event) => { if (event.target === event.currentTarget) ir({ hallazgo: null }); }}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloPanel}
            className="h-full w-full overflow-y-auto bg-white p-5 shadow-xl sm:max-w-2xl"
          >
            <div className="mb-4 flex justify-end">
              <button ref={cerrarRef} type="button" onClick={() => ir({ hallazgo: null })} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">
                Cerrar
              </button>
            </div>
            <MilesFicha tituloId={tituloPanel} row={detalle.hallazgo} eventos={detalle.eventos} comentarios={detalle.comentarios} investigaciones={detalle.investigaciones} onClose={() => ir({ hallazgo: null })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Indicador({ etiqueta, valor, activo, onClick }: { etiqueta: string; valor: number; activo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border bg-white px-3 py-2 text-left" style={{ borderColor: activo ? brand.green : "#E5E7EB" }}>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{etiqueta}</span>
      <span className="mt-1 block text-xl font-semibold tabular-nums">{valor}</span>
    </button>
  );
}

function Hallazgos({ filtros, hallazgos, ir, seleccionado }: { filtros: Filtros; hallazgos: Fila[]; ir: (patch: Record<string, string | null>) => void; seleccionado: string }) {
  const [mas, setMas] = useState(Boolean(filtros.desde || filtros.hasta || filtros.prioridad || filtros.estado || filtros.tipo));
  const [q, setQ] = useState(filtros.q);
  const irRef = useRef(ir);
  irRef.current = ir;
  useEffect(() => {
    setQ(filtros.q);
  }, [filtros.q]);
  useEffect(() => {
    if (q === filtros.q) return;
    const timer = window.setTimeout(() => irRef.current({ q: q || null }), 250);
    return () => window.clearTimeout(timer);
  }, [q, filtros.q]);
  const visibles = ordenar(hallazgos.filter((row) => coincide(row, { ...filtros, q })));
  const activos = [
    filtros.q ? `“${filtros.q}”` : "",
    filtros.rapido ? RAPIDOS.find(([id]) => id === filtros.rapido)?.[1] ?? (filtros.rapido === "resueltos" ? "Resueltos" : filtros.rapido) : "",
    filtros.tipo,
    filtros.estado,
    filtros.prioridad,
    filtros.desde ? `desde ${formatoDiaComercial(filtros.desde)}` : "",
    filtros.hasta ? `hasta ${formatoDiaComercial(filtros.hasta)}` : "",
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {RAPIDOS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => ir({ rapido: filtros.rapido === id ? null : id })} className="rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: filtros.rapido === id ? brand.ink : "#F3F4F6", color: filtros.rapido === id ? "#fff" : brand.ink }}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar un hallazgo"
          aria-label="Buscar un hallazgo"
          className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => setMas((value) => !value)} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold" aria-expanded={mas}>
          Más filtros
        </button>
      </div>
      {mas ? (
        <div className="flex flex-wrap gap-2">
          <Select label="Tipo" value={filtros.tipo} onChange={(value) => ir({ tipo: value })} opciones={["", "oportunidad", "deterioro", "patron", "anomalia", "calidad"]} />
          <Select label="Estado" value={filtros.estado} onChange={(value) => ir({ estado: value })} opciones={["", "vigente", "descartado", "archivado"]} />
          <Select label="Prioridad" value={filtros.prioridad} onChange={(value) => ir({ prioridad: value })} opciones={["", "alta", "media", "baja"]} />
          <label className="text-xs text-brand-muted">Desde<input type="date" value={filtros.desde} onChange={(event) => ir({ desde: event.target.value || null })} className="mt-1 block rounded-md border px-2 py-1 text-sm" /></label>
          <label className="text-xs text-brand-muted">Hasta<input type="date" value={filtros.hasta} onChange={(event) => ir({ hasta: event.target.value || null })} className="mt-1 block rounded-md border px-2 py-1 text-sm" /></label>
        </div>
      ) : null}
      {activos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {activos.map((item) => <span key={item} className="rounded-full bg-[#F3F4F6] px-2 py-1">{item}</span>)}
          <button type="button" onClick={() => ir({ q: null, rapido: null, tipo: null, estado: null, prioridad: null, desde: null, hasta: null })} className="font-semibold" style={{ color: "#3F6B1C" }}>Limpiar</button>
        </div>
      ) : null}
      {visibles.length === 0 ? <Vacio titulo={hallazgos.length === 0 ? "Miles todavía no ha publicado análisis" : "Nada coincide con estos filtros"} detalle={hallazgos.length === 0 ? "Cuando publique por la API, los hallazgos aparecen aquí. No hay ejemplos cargados." : "Prueba con Todos o limpia los filtros. Los resueltos siguen en su filtro."} /> : null}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {visibles.map((row) => (
          <Tarjeta key={String(row.id)} row={row} activo={seleccionado === String(row.id)} onOpen={() => ir({ hallazgo: String(row.id) })} />
        ))}
      </div>
    </div>
  );
}

function Tarjeta({ row, activo, onOpen }: { row: Fila; activo: boolean; onOpen: () => void }) {
  const clase = etiquetaClase(row);
  const visual = visualDe(row);
  const metrica = visual.coherente ? textoMetrica(visual.visual) : null;
  const comparacion = visual.coherente ? textoComparacion(visual.visual) : null;
  const limitacion = typeof row.limitaciones === "string" ? row.limitaciones.trim() : "";
  const explorar = enlacePrincipal(row);
  return (
    <article id={`hallazgo-${row.id}`} className="rounded-lg border bg-white p-4 shadow-sm" style={{ borderColor: activo ? brand.green : "#E5E7EB" }}>
      <div className="flex flex-wrap items-center gap-2">
        <Pildora tono="gris">{etiquetaTipo(String(row.tipo))}</Pildora>
        <Pildora tono={clase.tono}>{clase.texto}</Pildora>
      </div>
      <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">{String(row.titulo)}</h3>
      {metrica ? (
        <p className="mt-2">
          {visual.visual?.metrica?.nombre ? <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{visual.visual.metrica.nombre}</span> : null}
          <span className="text-2xl font-semibold tabular-nums leading-none">{metrica}</span>
        </p>
      ) : null}
      {comparacion ? <p className="mt-1 text-xs text-brand-muted">{comparacion}</p> : null}
      {visual.coherente && visual.visual && graficoAlcanza(visual.visual) ? <div className="mt-3"><MilesVisual visual={visual.visual} compacto /></div> : null}
      {!visual.coherente && visual.motivo ? <p className="mt-2 text-xs" style={{ color: brand.error }}>{visual.motivo}</p> : null}
      <p className="mt-2 line-clamp-2 text-sm text-brand-ink">{String(row.interpretacion || row.resumen)}</p>
      {limitacion ? <p className="mt-2 line-clamp-2 text-xs text-brand-muted">{limitacion}</p> : null}
      <div className="mt-3 flex flex-wrap gap-3">
        {explorar ? (
          <Link href={hrefExplorar(explorar.pantalla, explorar.query)} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
            Explorar datos
          </Link>
        ) : null}
        <button type="button" onClick={onOpen} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
          Ver detalle
        </button>
      </div>
    </article>
  );
}

function coincide(row: Fila, filtros: Filtros): boolean {
  if (filtros.rapido === "revisar" && !esPorRevisar(row)) return false;
  if (filtros.rapido === "oportunidades" && (String(row.tipo) !== "oportunidad" || esResuelto(row))) return false;
  if (filtros.rapido === "cambios" && (!["deterioro", "anomalia", "patron"].includes(String(row.tipo)) || esResuelto(row))) return false;
  if (filtros.rapido === "calidad" && (String(row.tipo) !== "calidad" || esResuelto(row))) return false;
  if (filtros.rapido === "resueltos" && !esResuelto(row)) return false;
  if (!filtros.rapido && esResuelto(row)) return false;
  if (filtros.tipo && String(row.tipo) !== filtros.tipo) return false;
  if (filtros.estado && String(row.estado) !== filtros.estado) return false;
  if (filtros.prioridad && String(row.prioridad) !== filtros.prioridad) return false;
  if (filtros.desde && String(row.periodo_hasta) < filtros.desde) return false;
  if (filtros.hasta && String(row.periodo_desde) > filtros.hasta) return false;
  if (filtros.q) {
    const q = filtros.q.toLowerCase();
    const texto = `${row.titulo ?? ""} ${row.resumen ?? ""} ${row.observacion ?? ""} ${row.interpretacion ?? ""}`.toLowerCase();
    if (!texto.includes(q)) return false;
  }
  return true;
}

function ordenar(rows: Fila[]): Fila[] {
  return [...rows].sort((a, b) => {
    const revision = Number(esPorRevisar(b)) - Number(esPorRevisar(a));
    if (revision !== 0) return revision;
    const alta = Number(b.prioridad === "alta") - Number(a.prioridad === "alta");
    if (alta !== 0) return alta;
    return String(b.publicado_en).localeCompare(String(a.publicado_en));
  });
}

function Pruebas({ pruebas, origen, estado, ir }: { pruebas: Fila[]; origen: string; estado: string; ir: (patch: Record<string, string | null>) => void }) {
  const router = useRouter();
  const [tablero, setTablero] = useState(pruebas.length > 4);
  const [confirmando, setConfirmando] = useState<{ id: string; version: number; estado: string } | null>(null);
  const [form, setForm] = useState({ hipotesis: "", accion: "", metricaPrincipal: "", responsable: "", inicioPrevisto: "", finPrevisto: "" });
  const [aviso, setAviso] = useState<string | null>(null);
  const visibles = estado ? pruebas.filter((row) => String(row.estado) === estado) : pruebas;

  async function crear(event: React.FormEvent) {
    event.preventDefault();
    const respuesta = await fetch("/api/admin/miles/pruebas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, hallazgoId: origen || null }),
    });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      setAviso(json.error ?? "No se pudo crear la propuesta");
      return;
    }
    setAviso(null);
    setForm({ hipotesis: "", accion: "", metricaPrincipal: "", responsable: "", inicioPrevisto: "", finPrevisto: "" });
    router.refresh();
  }

  async function mover(id: string, version: number, estado: string) {
    if (!confirmando || confirmando.id !== id || confirmando.estado !== estado) {
      setConfirmando({ id, version, estado });
      return;
    }
    const respuesta = await fetch(`/api/admin/miles/pruebas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, estado }),
    });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      setAviso(json.error ?? "Ese cambio no está permitido");
      setConfirmando(null);
      return;
    }
    setAviso(null);
    setConfirmando(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-brand-muted">Aprobar una propuesta no cambia precios, promociones, inventario ni pedidos.</p>
        <button type="button" onClick={() => setTablero((value) => !value)} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">
          {tablero ? "Ver lista" : "Ver tablero"}
        </button>
      </div>
      <form onSubmit={crear} className="grid gap-2 rounded-lg border border-[#E5E7EB] bg-white p-4 md:grid-cols-2">
        <input required placeholder="Hipótesis" value={form.hipotesis} onChange={(event) => setForm({ ...form, hipotesis: event.target.value })} className="rounded-md border px-3 py-2 text-sm" />
        <input required placeholder="Acción concreta" value={form.accion} onChange={(event) => setForm({ ...form, accion: event.target.value })} className="rounded-md border px-3 py-2 text-sm" />
        <input required placeholder="Métrica principal" value={form.metricaPrincipal} onChange={(event) => setForm({ ...form, metricaPrincipal: event.target.value })} className="rounded-md border px-3 py-2 text-sm" />
        <input placeholder="Responsable" value={form.responsable} onChange={(event) => setForm({ ...form, responsable: event.target.value })} className="rounded-md border px-3 py-2 text-sm" />
        <label className="text-xs text-brand-muted">Inicio previsto<input type="date" value={form.inicioPrevisto} onChange={(event) => setForm({ ...form, inicioPrevisto: event.target.value })} className="mt-1 block w-full rounded-md border px-2 py-1 text-sm" /></label>
        <label className="text-xs text-brand-muted">Fin previsto<input type="date" value={form.finPrevisto} onChange={(event) => setForm({ ...form, finPrevisto: event.target.value })} className="mt-1 block w-full rounded-md border px-2 py-1 text-sm" /></label>
        {origen ? <p className="text-xs text-brand-muted md:col-span-2">Quedará ligada al hallazgo de origen.</p> : null}
        <button type="submit" className="rounded-full px-3 py-1.5 text-sm font-semibold text-white md:col-span-2" style={{ backgroundColor: brand.green }}>Crear propuesta</button>
        {aviso ? <p className="text-sm md:col-span-2" style={{ color: brand.error }}>{aviso}</p> : null}
      </form>
      {visibles.length === 0 ? <Vacio titulo="No hay pruebas" detalle="Una recomendación se convierte en propuesta. Miles evalúa; la decisión queda de este lado." /> : null}
      {tablero ? (
        <div className="grid gap-3 md:grid-cols-3">
          {["propuesta", "aprobada", "en_curso", "pendiente_evaluacion", "finalizada", "cancelada"].map((estado) => (
            <section key={estado}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{etiquetaPrueba(estado)}</h3>
              <div className="mt-2 space-y-2">
                {visibles.filter((row) => String(row.estado) === estado).map((row) => (
                  <FichaPrueba key={String(row.id)} row={row} confirmar={confirmando} mover={mover} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibles.map((row) => <FichaPrueba key={String(row.id)} row={row} confirmar={confirmando} mover={mover} />)}
        </div>
      )}
      <button type="button" onClick={() => ir({ estado: null, origen: null })} className="text-xs font-semibold" style={{ color: "#3F6B1C" }}>Ver todos los estados</button>
    </div>
  );
}

function FichaPrueba({
  row,
  confirmar,
  mover,
}: {
  row: Fila;
  confirmar: { id: string; estado: string } | null;
  mover: (id: string, version: number, estado: string) => void;
}) {
  const pendiente = confirmar?.id === String(row.id) ? confirmar.estado : "";
  return (
    <article className="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pildora tono="gris">{etiquetaPrueba(String(row.estado))}</Pildora>
        {row.responsable ? <span className="text-xs text-brand-muted">{String(row.responsable)}</span> : null}
      </div>
      <p className="mt-2 text-sm font-semibold">{String(row.accion)}</p>
      <p className="mt-1 line-clamp-2 text-sm text-brand-muted">{String(row.hipotesis)}</p>
      <p className="mt-2 text-xs text-brand-muted">Métrica: {String(row.metrica_principal)}</p>
      <p className="mt-1 text-xs text-brand-muted">
        Previsto: {row.inicio_previsto ? formatoDiaComercial(row.inicio_previsto) : "sin fecha"} a {row.fin_previsto ? formatoDiaComercial(row.fin_previsto) : "sin fecha"}
      </p>
      {row.inicio_real || row.fin_real ? (
        <p className="text-xs text-brand-muted">Real: {row.inicio_real ? formatoDiaComercial(row.inicio_real) : "—"} a {row.fin_real ? formatoDiaComercial(row.fin_real) : "—"}</p>
      ) : null}
      <p className="mt-2 text-xs font-semibold">{pasoPrueba(String(row.estado))}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {siguiente(String(row.estado)).map((estado) => (
          <button key={estado} type="button" onClick={() => mover(String(row.id), Number(row.version), estado)} className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold">
            {pendiente === estado ? `Confirmar ${etiquetaPrueba(estado)}` : etiquetaPrueba(estado)}
          </button>
        ))}
      </div>
    </article>
  );
}

function Investigaciones({ investigaciones, hallazgos, pedir }: { investigaciones: Fila[]; hallazgos: Fila[]; pedir: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pregunta, setPregunta] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [contexto, setContexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const sugerencias = [
    "Investiga por qué cayó la venta de cerveza durante las últimas cuatro semanas",
    "¿Qué horas concentran la venta del fin de semana?",
    "¿La cobertura de costo alcanza para leer el margen de esta semana?",
  ];

  async function crear(event: React.FormEvent) {
    event.preventDefault();
    const respuesta = await fetch("/api/admin/miles/investigaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta, alcance: { tienda: "quick", desde, hasta, contexto } }),
    });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      setAviso(json.error ?? "No se pudo crear la solicitud");
      return;
    }
    setAviso("Quedó pendiente. Miles todavía no la ha tomado.");
    setPregunta("");
    setContexto("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={crear} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-sm font-semibold">Pedir investigación</h2>
        <textarea required minLength={8} value={pregunta} onChange={(event) => setPregunta(event.target.value)} placeholder="Qué quieres entender" className="mt-3 min-h-24 w-full rounded-md border px-3 py-2 text-sm" autoFocus={pedir} />
        <div className="mt-2 flex flex-wrap gap-2">
          {sugerencias.map((texto) => (
            <button key={texto} type="button" onClick={() => setPregunta(texto)} className="rounded-full bg-[#F3F4F6] px-3 py-1 text-left text-xs">
              {texto}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <p className="rounded-md border border-[#E5E7EB] px-3 py-2 text-sm">Tienda: Quick!</p>
          <label className="text-xs text-brand-muted">Desde<input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="mt-1 block w-full rounded-md border px-2 py-1 text-sm" /></label>
          <label className="text-xs text-brand-muted">Hasta<input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="mt-1 block w-full rounded-md border px-2 py-1 text-sm" /></label>
        </div>
        <input value={contexto} onChange={(event) => setContexto(event.target.value)} placeholder="Contexto opcional" className="mt-2 w-full rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="mt-3 rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>Crear solicitud</button>
        <p className="mt-2 text-xs text-brand-muted">Queda pendiente hasta que Miles la tome por la API. Crearla no significa que ya la esté analizando.</p>
        {aviso ? <p className="mt-2 text-sm text-brand-muted">{aviso}</p> : null}
      </form>
      {investigaciones.length === 0 ? <Vacio titulo="No hay investigaciones" detalle="Las preguntas y las ampliaciones de un hallazgo se listan aquí." /> : null}
      {investigaciones.map((row) => {
        const hallazgo = hallazgos.find((item) => String(item.id) === String(row.hallazgo_id));
        return (
          <article key={String(row.id)} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pildora tono={row.estado === "pendiente" ? "naranja" : row.estado === "completada" ? "verde" : "gris"}>{etiquetaInvestigacion(String(row.estado))}</Pildora>
              <span className="text-xs text-brand-muted">{formatoInstante(row.creada_en)} · {String(row.solicitante)}</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{String(row.pregunta)}</p>
            {row.estado === "pendiente" ? <p className="mt-1 text-xs text-brand-muted">Pendiente. Miles todavía no la ha tomado.</p> : null}
            {row.estado === "en_analisis" ? <p className="mt-1 text-xs text-brand-muted">Miles la tomó y la está analizando.</p> : null}
            {row.respuesta ? <p className="mt-2 text-sm">{String(row.respuesta)}</p> : null}
            {hallazgo ? (
              <button type="button" onClick={() => router.push(`${pathname}?vista=hallazgos&hallazgo=${hallazgo.id}`)} className="mt-2 text-sm font-semibold" style={{ color: "#3F6B1C" }}>
                Ver hallazgo
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Actividad({
  ejecuciones,
  credencial,
  token,
  error,
  emitir,
}: {
  ejecuciones: Fila[];
  credencial: { id: string; prefijo: string; creadoEn: string } | null;
  token: string | null;
  error: string | null;
  emitir: () => void;
}) {
  return (
    <div className="space-y-4">
      {ejecuciones.length === 0 ? <Vacio titulo="Sin ejecuciones" detalle="Cuando Miles abra una corrida por la API, aparece aquí." /> : null}
      {ejecuciones.map((row) => (
        <article key={String(row.id)} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <p className="text-sm font-semibold">{String(row.estado)}</p>
          <p className="mt-1 text-xs text-brand-muted">
            Inicio {formatoInstante(row.iniciada_en)}
            {row.terminada_en ? ` · Fin ${formatoInstante(row.terminada_en)}` : ""}
            {row.datos_hasta ? ` · Datos hasta ${formatoDiaComercial(row.datos_hasta)}` : ""}
          </p>
          {row.error ? <p className="mt-2 text-sm" style={{ color: brand.error }}>{String(row.error)}</p> : null}
        </article>
      ))}
      <section className="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-sm font-semibold">Credencial de Miles</h2>
        <p className="mt-1 text-sm text-brand-muted">{credencial ? `Hay un token activo que empieza por ${credencial.prefijo}. El secreto no se vuelve a mostrar.` : "Todavía no hay token."}</p>
        <button type="button" onClick={emitir} className="mt-3 rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>
          {credencial ? "Rotar token" : "Emitir token"}
        </button>
        {token ? <p className="mt-3 break-all rounded-md bg-[#F8FAF7] p-3 text-sm">Cópialo ahora. No queda guardado en claro: {token}</p> : null}
        {error ? <p className="mt-2 text-sm" style={{ color: brand.error }}>{error}</p> : null}
      </section>
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

function etiquetaPrueba(estado: string): string {
  const nombres: Record<string, string> = {
    propuesta: "Propuesta",
    aprobada: "Aprobada",
    en_curso: "En curso",
    pendiente_evaluacion: "Pendiente de evaluación",
    finalizada: "Finalizada",
    cancelada: "Cancelada",
  };
  return nombres[estado] ?? estado;
}

function pasoPrueba(estado: string): string {
  if (estado === "propuesta") return "Próximo paso: aprobarla o cancelarla. Aprobar no la ejecuta.";
  if (estado === "aprobada") return "Próximo paso: ponerla en curso cuando alguien la ejecute.";
  if (estado === "en_curso") return "Próximo paso: pasar a evaluación cuando termine el periodo.";
  if (estado === "pendiente_evaluacion") return "Próximo paso: Miles publica la evaluación. La decisión sigue siendo humana.";
  if (estado === "finalizada") return "Cerrada. El resultado no se infiere solo del paso del tiempo.";
  return "Cancelada.";
}

function etiquetaInvestigacion(estado: string): string {
  const nombres: Record<string, string> = {
    pendiente: "Pendiente",
    en_analisis: "En análisis",
    requiere_informacion: "Requiere información",
    completada: "Completada",
    cancelada: "Cancelada",
  };
  return nombres[estado] ?? estado;
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
