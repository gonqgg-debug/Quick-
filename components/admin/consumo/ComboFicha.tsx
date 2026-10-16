"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FotoProducto } from "@/components/admin/catalogo/producto-ui";
import { visualDe } from "@/components/admin/consumo/MilesFicha";
import { MilesVisual } from "@/components/admin/consumo/MilesVisual";
import { Pildora } from "@/components/admin/consumo/ui";
import { COSTO_METODO } from "@/lib/consumo-metricas";
import { formatoDiaComercial, formatoInstante } from "@/lib/miles-presentacion";
import { calcularPromo, FORMULA_PROMO, type EntradaPromo, type SupuestosPromo } from "@/lib/promo-calculo";
import {
  ETIQUETA_ESTADO_PROPUESTA,
  ETIQUETA_ESTADO_PRUEBA,
  ETIQUETA_FUNCION_PRODUCTO,
  ETIQUETA_TIPO_PROMO,
  cantidadTexto,
  dinero,
  metricaObservada,
  probabilidadCompleta,
} from "@/lib/promo-presentacion";
import { brand } from "@/lib/theme";

type Fila = Record<string, unknown>;

type LineaEditable = {
  productId: string;
  nombre: string;
  cantidad: string;
  precioPromo: string;
  precioHabitual: number | null;
  habitualObservado: boolean;
  costo: number | null;
  tasa: number | null;
};

const MECANICA_CAMPOS: Array<[string, string]> = [
  ["precioCombo", "Precio o incentivo"],
  ["descuento", "Descuento"],
  ["compraMinima", "Compra mínima"],
  ["canal", "Canal"],
  ["dias", "Días"],
  ["horas", "Horas"],
  ["duracion", "Duración"],
  ["exclusiones", "Exclusiones"],
  ["acumulacion", "Acumulación con otras promociones"],
  ["limites", "Límites y disponibilidad"],
  ["caja", "Requisitos de caja"],
];

export function ComboFicha({ propuesta }: { propuesta: Fila }) {
  const router = useRouter();
  const productos = Array.isArray(propuesta.productos) ? (propuesta.productos as Fila[]) : [];
  const hallazgos = Array.isArray(propuesta.hallazgos) ? (propuesta.hallazgos as Fila[]) : [];
  const pruebas = Array.isArray(propuesta.pruebas) ? (propuesta.pruebas as Fila[]) : [];
  const variantes = Array.isArray(propuesta.variantes) ? (propuesta.variantes as Fila[]) : [];
  const eventos = Array.isArray(propuesta.eventos) ? (propuesta.eventos as Fila[]) : [];
  const mecanicaGuardada = objeto(propuesta.mecanica);
  const evidencia = objeto(propuesta.evidencia);
  const [lineas, setLineas] = useState<LineaEditable[]>(() => productos.map(lineaInicial));
  const [precioCombo, setPrecioCombo] = useState(mecanicaGuardada.precioCombo == null ? "" : String(mecanicaGuardada.precioCombo));
  const [descuento, setDescuento] = useState(mecanicaGuardada.descuento == null ? "" : String(mecanicaGuardada.descuento));
  const [duracion, setDuracion] = useState(mecanicaGuardada.duracion == null ? "" : String(mecanicaGuardada.duracion));
  const [supuestos, setSupuestos] = useState(() => supuestosTexto(objeto(propuesta.supuestos)));
  const [nombreVariante, setNombreVariante] = useState("Variante");
  const [varianteId, setVarianteId] = useState("");
  const [prueba, setPrueba] = useState({ hipotesis: String(propuesta.comportamiento ?? ""), accion: String(propuesta.nombre ?? ""), metricaPrincipal: "", responsable: "", inicioPrevisto: "", finPrevisto: "" });
  const [pregunta, setPregunta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState("");
  const visual = visualDe(propuesta);
  const metrica = metricaObservada(propuesta.metricas);
  const probabilidad = probabilidadCompleta(propuesta.probabilidad);
  const tipo = String(propuesta.tipo);

  const preview = useMemo(() => calcularVista(tipo, lineas, precioCombo, descuento, supuestos), [tipo, lineas, precioCombo, descuento, supuestos]);

  async function post(url: string, body: Record<string, unknown>) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const respuesta = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await respuesta.json().catch(() => ({}));
    setOcupado(false);
    if (!respuesta.ok) {
      setError(json.error ?? "No se pudo guardar");
      return null;
    }
    setAviso(json.aviso ?? "Guardado");
    router.refresh();
    return json;
  }

  async function patch(body: Record<string, unknown>) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const respuesta = await fetch(`/api/admin/miles/propuestas/${propuesta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: Number(propuesta.version), ...body }),
    });
    const json = await respuesta.json().catch(() => ({}));
    setOcupado(false);
    if (!respuesta.ok) {
      setError(json.error ?? "No se pudo actualizar");
      return;
    }
    setAviso(json.aviso ?? "Actualizado");
    setConfirmar("");
    router.refresh();
  }

  function cuerpoSimulador() {
    return {
      lineas: lineas.map((linea) => ({
        productId: linea.productId,
        cantidad: leerNumero(linea.cantidad).valor,
        precioPromo: linea.precioPromo.trim() === "" ? null : leerNumero(linea.precioPromo).valor,
      })),
      mecanica: { ...mecanicaGuardada, precioCombo: leerNumero(precioCombo).valor, descuento: leerNumero(descuento).valor, duracion },
      supuestos: supuestosNumericos(supuestos),
    };
  }

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/consumo/miles?vista=combos" className="text-sm font-semibold" style={{ color: brand.green }}>Volver a combos y promos</Link>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pildora tono="gris">{ETIQUETA_TIPO_PROMO[tipo] ?? tipo}</Pildora>
          <Pildora tono="naranja">{ETIQUETA_ESTADO_PROPUESTA[String(propuesta.estado)] ?? String(propuesta.estado)}</Pildora>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold">{String(propuesta.nombre)}</h1>
        <p className="mt-2 text-sm text-brand-muted">Lista para probar no enciende la promoción en caja. El estado de cada prueba va aparte.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">La oportunidad</h2>
        <p>{String(propuesta.comportamiento)}</p>
        <p className="text-sm text-brand-muted">
          Quick! · {formatoDiaComercial(propuesta.periodo_desde)} a {formatoDiaComercial(propuesta.periodo_hasta)}
          {propuesta.corte ? ` · corte ${formatoDiaComercial(propuesta.corte)}` : ""}
        </p>
        <p className="text-sm"><span className="font-semibold">Dato observado. </span>{metrica ? `${metrica.nombre}: ${metrica.valor}` : "No hay una métrica observada en la publicación."}</p>
        {hallazgos.length === 0 ? <p className="text-sm text-brand-muted">No hay un hallazgo vinculado.</p> : (
          <ul className="space-y-1 text-sm">
            {hallazgos.map((hallazgo) => (
              <li key={String(hallazgo.id)}>
                <Link href={`/admin/consumo/miles/${hallazgo.id}`} className="font-semibold" style={{ color: brand.green }}>{String(hallazgo.titulo)}</Link>
                <span className="text-brand-muted"> · {String(hallazgo.tipo)} · {formatoDiaComercial(hallazgo.periodo_desde)} a {formatoDiaComercial(hallazgo.periodo_hasta)}</span>
              </li>
            ))}
          </ul>
        )}
        {visual.visual && visual.coherente ? <MilesVisual visual={visual.visual} /> : null}
        {visual.visual && !visual.coherente ? <p className="text-sm text-brand-muted">La visualización no coincide con el snapshot y no se usa como evidencia. {visual.motivo}</p> : null}
        {propuesta.limitaciones ? <p className="text-sm">Limitaciones: {String(propuesta.limitaciones)}</p> : <p className="text-sm text-brand-muted">Sin limitaciones escritas.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Productos</h2>
        <ul className="space-y-4">
          {productos.map((producto) => (
            <li key={String(producto.productId)} className="rounded-lg border border-[#E5E7EB] p-3">
              <div className="flex gap-3">
                <FotoProducto src={producto.fotoUrl ? String(producto.fotoUrl) : null} size="lista" />
                <div className="min-w-0">
                  <Link href={`/admin/catalogo/productos/${producto.productId}`} className="font-semibold" style={{ color: brand.green }}>{String(producto.nombre)}</Link>
                  <p className="text-xs text-brand-muted">{producto.presentacion ? String(producto.presentacion) : "Sin presentación indicada"} · {ETIQUETA_FUNCION_PRODUCTO[String(producto.funcion)] ?? String(producto.funcion)} · {cantidadTexto(producto.cantidad)}</p>
                </div>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Dato etiqueta="Precio observado" valor={producto.precio_habitual == null ? "No disponible" : `${dinero(producto.precio_habitual)}${producto.precio_observado_en ? ` · ${formatoDiaComercial(producto.precio_observado_en)}` : ""}`} />
                <Dato etiqueta="Precio actual del catálogo" valor={producto.precioActual == null ? "No disponible" : dinero(producto.precioActual)} />
                <Dato etiqueta={`Costo actual · ${COSTO_METODO}`} valor={producto.costoActual == null ? "No disponible" : `${dinero(producto.costoActual)}${producto.costoOrigen ? ` · ${producto.costoOrigen}` : ""}${producto.costoFecha ? ` · ${formatoDiaComercial(producto.costoFecha)}` : ""}`} />
                <Dato etiqueta="Tasa ITBIS" valor={producto.tasa == null ? "No disponible" : `${producto.tasa}%`} />
                <Dato etiqueta="Existencias" valor={producto.existencias == null ? "No disponible" : `${cantidadTexto(producto.existencias)}${producto.existenciasFecha ? ` · ${formatoDiaComercial(producto.existenciasFecha)}` : ""}`} />
                <Dato etiqueta="Ventas del periodo" valor={producto.ventasPeriodo == null ? "No disponible" : dinero(producto.ventasPeriodo)} />
                <Dato etiqueta="Unidades del periodo" valor={producto.unidadesPeriodo == null ? "No disponible" : cantidadTexto(producto.unidadesPeriodo)} />
                <Dato etiqueta="Tickets del periodo" valor={producto.ticketsPeriodo == null ? "No disponible" : cantidadTexto(producto.ticketsPeriodo)} />
              </dl>
            </li>
          ))}
        </ul>
        {propuesta.costos ? <p className="text-xs text-brand-muted">Miles informó costos aparte. El simulador no los usa: calcula con el costo vigente de la plataforma.</p> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Mecánica</h2>
        <ul className="text-sm">
          {productos.map((producto) => (
            <li key={`mec-${producto.productId}`}>{cantidadTexto(producto.cantidad)} × {String(producto.nombre)}</li>
          ))}
        </ul>
        <dl className="grid gap-2 sm:grid-cols-2">
          {MECANICA_CAMPOS.map(([campo, etiqueta]) => (
            <Dato key={campo} etiqueta={etiqueta} valor={textoMecanica(campo, mecanicaGuardada, productos)} />
          ))}
          <Dato etiqueta="Descuento efectivo" valor={preview.resultado ? dinero(preview.resultado.combinacion.diferenciaPrecio) : "No disponible"} />
        </dl>
        <p className="text-xs text-brand-muted">El descuento efectivo es un escenario calculado con la fórmula {FORMULA_PROMO}, no un dato de caja.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Simulador</h2>
        <p className="text-sm text-brand-muted">Editar aquí no cambia precios ni promociones. Cambiar un descuento no dice cuánto va a subir la demanda.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <fieldset className="space-y-2 rounded-lg border border-[#E5E7EB] p-3">
            <legend className="px-1 text-sm font-semibold">Precio y costo</legend>
            {lineas.map((linea, index) => (
              <div key={linea.productId} className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-brand-muted">
                  Cantidad de {linea.nombre}
                  <input inputMode="decimal" value={linea.cantidad} onChange={(event) => actualizarLinea(setLineas, index, { cantidad: event.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs text-brand-muted">
                  Precio promocional
                  <input inputMode="decimal" value={linea.precioPromo} onChange={(event) => actualizarLinea(setLineas, index, { precioPromo: event.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
                </label>
                <p className="text-xs text-brand-muted sm:col-span-2">{linea.habitualObservado ? `Habitual observado ${dinero(linea.precioHabitual)}` : linea.precioHabitual == null ? "Sin precio habitual." : `Sin precio observado: el cálculo usa el precio actual ${dinero(linea.precioHabitual)}.`}</p>
              </div>
            ))}
            <label className="block text-xs text-brand-muted">
              Precio único del combo
              <input inputMode="decimal" value={precioCombo} onChange={(event) => setPrecioCombo(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs text-brand-muted">
              Descuento absoluto
              <input inputMode="decimal" value={descuento} onChange={(event) => setDescuento(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs text-brand-muted">
              Duración, no multiplica la demanda
              <input value={duracion} onChange={(event) => setDuracion(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
            </label>
          </fieldset>
          <fieldset className="space-y-2 rounded-lg border border-[#E5E7EB] p-3">
            <legend className="px-1 text-sm font-semibold">Supuestos de comportamiento</legend>
            <Campo etiqueta="Tickets elegibles" valor={supuestos.ticketsElegibles} onChange={(valor) => setSupuestos({ ...supuestos, ticketsElegibles: valor })} />
            <Campo etiqueta="Ya compraban la combinación" valor={supuestos.yaCompraban} onChange={(valor) => setSupuestos({ ...supuestos, yaCompraban: valor })} />
            <Campo etiqueta="Adopción o acompañamiento supuesto, de 0 a 1" valor={supuestos.adopcion} onChange={(valor) => setSupuestos({ ...supuestos, adopcion: valor })} />
            <Campo etiqueta="Sustitución supuesta, de 0 a 1" valor={supuestos.sustitucion} onChange={(valor) => setSupuestos({ ...supuestos, sustitucion: valor })} />
            <Campo etiqueta="Adopción conservadora" valor={supuestos.conservador} onChange={(valor) => setSupuestos({ ...supuestos, conservador: valor })} />
            <Campo etiqueta="Adopción favorable" valor={supuestos.favorable} onChange={(valor) => setSupuestos({ ...supuestos, favorable: valor })} />
            {tipo === "compra_minima" ? (
              <>
                <Campo etiqueta="Costo del beneficio por ticket que ya superaba el umbral" valor={supuestos.costoBeneficio} onChange={(valor) => setSupuestos({ ...supuestos, costoBeneficio: valor })} />
                <Campo etiqueta="Margen supuesto de la compra que cruza el umbral" valor={supuestos.margenIncrementalUmbral} onChange={(valor) => setSupuestos({ ...supuestos, margenIncrementalUmbral: valor })} />
              </>
            ) : null}
          </fieldset>
        </div>
        {preview.error ? <p className="text-sm" style={{ color: brand.error }}>{preview.error}</p> : null}
        {preview.resultado ? <Resultados resultado={preview.resultado} /> : null}
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-brand-muted">
            Nombre de la variante
            <input value={nombreVariante} onChange={(event) => setNombreVariante(event.target.value)} className="mt-1 block rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
          </label>
          <button type="button" disabled={ocupado || Boolean(preview.error)} onClick={() => void post(`/api/admin/miles/propuestas/${propuesta.id}/variantes`, { nombre: nombreVariante, ...cuerpoSimulador() })} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
            Guardar variante
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Evidencia y confianza</h2>
        <p className="text-sm"><span className="font-semibold">Solidez {String(evidencia.solidez ?? "no indicada")}. </span>{evidencia.fundamento ? String(evidencia.fundamento) : "Sin fundamento."}</p>
        <p className="text-sm">Tipo de proyección: {probabilidad ? "pronóstico" : "escenario"}.</p>
        {probabilidad ? (
          <div className="rounded-lg bg-[#F8FAF7] p-3 text-sm">
            <p>Probabilidad de cumplir el objetivo: {Math.round(probabilidad.valor * 1000) / 10}%.</p>
            <p className="mt-1 text-brand-muted">{probabilidad.objetivo} · {probabilidad.horizonte} · {probabilidad.modelo} {probabilidad.version} · evaluada {formatoDiaComercial(probabilidad.evaluadaEn)}.</p>
            <p className="mt-1 text-brand-muted">Validación: {probabilidad.validacion}. Limitaciones: {probabilidad.limitaciones}.</p>
            {probabilidad.intervalo ? <p className="mt-1">Intervalo {probabilidad.intervalo.inferior} a {probabilidad.intervalo.superior}. Representa: {probabilidad.intervalo.representa}.</p> : null}
          </div>
        ) : (
          <p className="text-sm">Todavía no estimable. Requiere una prueba.</p>
        )}
        {Array.isArray(propuesta.escenarios) && propuesta.escenarios.length > 0 ? (
          <p className="text-xs text-brand-muted">Miles publicó escenarios externos. Si la aritmética coincide, sigue siendo una estimación externa y no un modelo validado.</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Decisión y seguimiento</h2>
        {pruebas.length === 0 ? <p className="text-sm text-brand-muted">Todavía no hay pruebas. Una prueba finalizada no marca la propuesta como validada.</p> : (
          <ul className="space-y-1 text-sm">
            {pruebas.map((item) => (
              <li key={String(item.id)}>
                <Link href="/admin/consumo/miles?vista=pruebas" className="font-semibold" style={{ color: brand.green }}>{String(item.accion ?? item.hipotesis ?? "Prueba")}</Link>
                <span className="text-brand-muted"> · {ETIQUETA_ESTADO_PRUEBA[String(item.estado)] ?? String(item.estado)}</span>
              </li>
            ))}
          </ul>
        )}
        <form className="grid gap-2 rounded-lg border border-[#E5E7EB] p-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void post(`/api/admin/miles/propuestas/${propuesta.id}/prueba`, { ...prueba, varianteId: varianteId || null, ...cuerpoSimulador() }); }}>
          <p className="text-sm text-brand-muted md:col-span-2">Los mismos datos de una prueba. Lo que falte hay que completarlo. Se guarda un snapshot de estas condiciones.</p>
          <label className="text-xs text-brand-muted">Hipótesis<input required value={prueba.hipotesis} onChange={(event) => setPrueba({ ...prueba, hipotesis: event.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-brand-muted">Acción<input required value={prueba.accion} onChange={(event) => setPrueba({ ...prueba, accion: event.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-brand-muted">Métrica principal<input required value={prueba.metricaPrincipal} onChange={(event) => setPrueba({ ...prueba, metricaPrincipal: event.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-brand-muted">Responsable<input value={prueba.responsable} onChange={(event) => setPrueba({ ...prueba, responsable: event.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-brand-muted">Inicio previsto<input type="date" value={prueba.inicioPrevisto} onChange={(event) => setPrueba({ ...prueba, inicioPrevisto: event.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-brand-muted">Fin previsto<input type="date" value={prueba.finPrevisto} onChange={(event) => setPrueba({ ...prueba, finPrevisto: event.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" /></label>
          {variantes.length > 0 ? (
            <label className="text-xs text-brand-muted md:col-span-2">
              Variante aprobada para esta prueba
              <select value={varianteId} onChange={(event) => setVarianteId(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm">
                <option value="">Condiciones actuales del simulador</option>
                {variantes.map((variante) => <option key={String(variante.id)} value={String(variante.id)}>{String(variante.nombre)} · {String(variante.autor)}</option>)}
              </select>
            </label>
          ) : null}
          <button type="submit" disabled={ocupado} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2" style={{ backgroundColor: brand.green }}>Crear prueba</button>
        </form>
        <label className="block text-xs text-brand-muted">
          Pedir ampliación
          <textarea value={pregunta} onChange={(event) => setPregunta(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
        </label>
        <button type="button" disabled={ocupado || pregunta.trim().length < 3} onClick={() => void patch({ accion: "ampliacion", pregunta })} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Dejar la solicitud</button>
        <label className="block text-xs text-brand-muted">
          Motivo para descartar
          <input value={motivo} onChange={(event) => setMotivo(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ocupado || motivo.trim().length < 3} onClick={() => void patch({ accion: "descartar", motivo })} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: brand.error }}>Descartar</button>
          <button type="button" disabled={ocupado} onClick={() => { if (confirmar === "lista") void patch({ accion: "lista" }); else setConfirmar("lista"); }} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">{confirmar === "lista" ? "Confirmar lista para probar" : "Marcar lista para probar"}</button>
          <button type="button" disabled={ocupado} onClick={() => { if (confirmar === "archivar") void patch({ accion: "archivar" }); else setConfirmar("archivar"); }} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">{confirmar === "archivar" ? "Confirmar archivo" : "Archivar"}</button>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Ver historial</summary>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="text-brand-muted">Publicada {formatoInstante(propuesta.publicado_en)} · {String(propuesta.autor ?? "miles")}</li>
            {eventos.map((evento) => (
              <li key={String(evento.id)}>{formatoInstante(evento.en)} · {String(evento.actor)} · {String(evento.accion)}</li>
            ))}
            {variantes.map((variante) => (
              <li key={String(variante.id)}>{formatoInstante(variante.creada_en)} · {String(variante.autor)} · variante {String(variante.nombre)}</li>
            ))}
          </ul>
          {propuesta.descarte_motivo ? <p className="mt-2 text-sm">Motivo del descarte: {String(propuesta.descarte_motivo)}</p> : null}
        </details>
        {error ? <p className="text-sm" style={{ color: brand.error }}>{error}</p> : null}
        {aviso ? <p className="text-sm text-brand-muted">{aviso}</p> : null}
      </section>
    </div>
  );
}

function Resultados({ resultado }: { resultado: ReturnType<typeof calcularPromo> }) {
  const combo = resultado.combinacion;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Escenario calculado · {resultado.formula}</p>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Dato etiqueta="Ingreso neto por combinación" valor={dinero(combo.ingreso)} />
        <Dato etiqueta="Costo" valor={dinero(combo.costo)} />
        <Dato etiqueta="Margen bruto por combinación" valor={dinero(combo.margen)} />
        <Dato etiqueta="Diferencia frente al precio habitual" valor={dinero(combo.diferenciaPrecio)} />
        <Dato etiqueta="Costo del incentivo" valor={dinero(combo.margenCedido)} />
        <Dato etiqueta="Punto de equilibrio" valor={resultado.equilibrio.tasa == null ? resultado.equilibrio.limitacion ?? "No disponible" : `Adopción supuesta ${resultado.equilibrio.tasa}`} />
      </dl>
      {combo.limitacion ? <p className="text-sm text-brand-muted">{combo.limitacion}</p> : null}
      <ul className="space-y-2 text-sm">
        {resultado.escenarios.map((escenario) => (
          <li key={escenario.nombre} className="rounded-lg bg-[#F8FAF7] px-3 py-2">
            <span className="font-semibold">{escenario.nombre}</span>
            <span className="text-brand-muted"> · {escenario.supuesto}</span>
            {escenario.resultado == null ? <p>{escenario.limitacion ?? "Sin resultado total."}</p> : (
              <p>Resultado {dinero(escenario.resultado)}. Nuevas {cantidadTexto(escenario.redencionesNuevas)}. Costo sobre quienes ya compraban {dinero(escenario.costoSobreExistentes)}.</p>
            )}
          </li>
        ))}
      </ul>
      <Curva puntos={resultado.sensibilidad.puntos} equilibrio={resultado.equilibrio.tasa} eje={resultado.sensibilidad.eje} />
    </div>
  );
}

function Curva({ puntos, equilibrio, eje }: { puntos: Array<{ supuesto: number; resultado: number | null }>; equilibrio: number | null; eje: string }) {
  const validos = puntos.filter((punto): punto is { supuesto: number; resultado: number } => punto.resultado != null);
  if (validos.length === 0) return <p className="text-sm text-brand-muted">No hay gráfico de sensibilidad hasta que el margen y los supuestos permitan un resultado.</p>;
  const min = Math.min(...validos.map((punto) => punto.resultado), 0);
  const max = Math.max(...validos.map((punto) => punto.resultado), 0);
  const span = max - min || 1;
  const width = 320;
  const height = 150;
  const x = (supuesto: number) => 28 + supuesto * (width - 44);
  const y = (valor: number) => 12 + ((max - valor) / span) * (height - 40);
  const trazo = validos.map((punto, index) => `${index === 0 ? "M" : "L"}${x(punto.supuesto)},${y(punto.resultado)}`).join(" ");
  const marca = equilibrio != null && equilibrio >= 0 && equilibrio <= 1 ? x(equilibrio) : null;
  return (
    <figure>
      <svg role="img" aria-label={`Margen frente a adopción supuesta. ${eje}`} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-md">
        <line x1={28} x2={width - 12} y1={y(0)} y2={y(0)} stroke="#E5E7EB" />
        <path d={trazo} fill="none" stroke={brand.green} strokeWidth={2} />
        {marca != null ? <line x1={marca} x2={marca} y1={8} y2={height - 28} stroke="#111827" strokeDasharray="3 3" /> : null}
        <text x={28} y={height - 8} fontSize={10} fill="#6B7280">0</text>
        <text x={width - 28} y={height - 8} fontSize={10} fill="#6B7280">1</text>
      </svg>
      <figcaption className="text-xs text-brand-muted">{eje}{marca != null ? " La línea vertical es el equilibrio con esos supuestos." : ""}</figcaption>
    </figure>
  );
}

function Campo({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (valor: string) => void }) {
  return (
    <label className="block text-xs text-brand-muted">
      {etiqueta}
      <input inputMode="decimal" value={valor} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
    </label>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] text-brand-muted">{etiqueta}</dt>
      <dd className="text-sm">{valor}</dd>
    </div>
  );
}

function actualizarLinea(setLineas: (value: LineaEditable[] | ((prev: LineaEditable[]) => LineaEditable[])) => void, index: number, patch: Partial<LineaEditable>) {
  setLineas((prev) => prev.map((linea, posicion) => (posicion === index ? { ...linea, ...patch } : linea)));
}

function lineaInicial(producto: Fila): LineaEditable {
  const observado = producto.precio_habitual != null;
  const habitual = observado ? Number(producto.precio_habitual) : producto.precioActual != null ? Number(producto.precioActual) : null;
  return {
    productId: String(producto.productId),
    nombre: String(producto.nombre ?? "Producto"),
    cantidad: String(producto.cantidad ?? 1),
    precioPromo: producto.precio_promo == null ? "" : String(producto.precio_promo),
    precioHabitual: habitual != null && Number.isFinite(habitual) ? habitual : null,
    habitualObservado: observado,
    costo: producto.costoActual == null ? null : Number(producto.costoActual),
    tasa: producto.tasa == null ? null : Number(producto.tasa),
  };
}

function supuestosTexto(raw: Fila) {
  const texto = (campo: string) => (raw[campo] == null || raw[campo] === "" ? "" : String(raw[campo]));
  return {
    ticketsElegibles: texto("ticketsElegibles"),
    yaCompraban: texto("yaCompraban"),
    adopcion: texto("adopcion"),
    sustitucion: texto("sustitucion"),
    costoBeneficio: texto("costoBeneficio"),
    margenIncrementalUmbral: texto("margenIncrementalUmbral"),
    conservador: texto("conservador"),
    favorable: texto("favorable"),
  };
}

function supuestosNumericos(raw: ReturnType<typeof supuestosTexto>): SupuestosPromo {
  const numero = (valor: string) => leerNumero(valor).valor;
  return {
    ticketsElegibles: numero(raw.ticketsElegibles),
    yaCompraban: numero(raw.yaCompraban),
    adopcion: numero(raw.adopcion),
    sustitucion: numero(raw.sustitucion),
    costoBeneficio: numero(raw.costoBeneficio),
    margenIncrementalUmbral: numero(raw.margenIncrementalUmbral),
    conservador: numero(raw.conservador),
    favorable: numero(raw.favorable),
  };
}

function leerNumero(value: string): { valor: number | null; error: boolean } {
  const limpio = value.trim().replace(",", ".");
  if (!limpio) return { valor: null, error: false };
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero < 0) return { valor: null, error: true };
  return { valor: numero, error: false };
}

function calcularVista(tipo: string, lineas: LineaEditable[], precioCombo: string, descuento: string, supuestos: ReturnType<typeof supuestosTexto>) {
  const entradas = [precioCombo, descuento, ...lineas.flatMap((linea) => [linea.cantidad, linea.precioPromo]), ...Object.values(supuestos)];
  if (entradas.some((valor) => leerNumero(valor).error)) return { error: "Hay un número que no se puede leer.", resultado: null };
  if (lineas.some((linea) => linea.precioHabitual == null || leerNumero(linea.cantidad).valor == null)) {
    return { error: "Falta el precio habitual o la cantidad de un producto.", resultado: null };
  }
  const entrada: EntradaPromo = {
    tipo: tipo as EntradaPromo["tipo"],
    lineas: lineas.map((linea) => ({
      productId: linea.productId,
      cantidad: leerNumero(linea.cantidad).valor ?? 0,
      precioHabitual: linea.precioHabitual ?? 0,
      precioPromo: leerNumero(linea.precioPromo).valor,
      costo: linea.costo,
      tasa: linea.tasa,
    })),
    precioCombo: leerNumero(precioCombo).valor,
    descuento: leerNumero(descuento).valor,
    supuestos: supuestosNumericos(supuestos),
  };
  return { error: null, resultado: calcularPromo(entrada) };
}

function textoMecanica(campo: string, mecanica: Fila, productos: Fila[]): string {
  if (campo === "precioCombo" && (mecanica.precioCombo == null || mecanica.precioCombo === "")) {
    const promos = productos.filter((producto) => producto.precio_promo != null);
    if (promos.length > 0) return promos.map((producto) => `${producto.nombre}: ${dinero(producto.precio_promo)}`).join(" · ");
  }
  if (mecanica[campo] == null || mecanica[campo] === "") return "No indicado";
  return String(mecanica[campo]);
}

function objeto(value: unknown): Fila {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fila) : {};
}
