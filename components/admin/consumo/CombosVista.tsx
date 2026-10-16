"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FotoProducto } from "@/components/admin/catalogo/producto-ui";
import { Pildora, Vacio } from "@/components/admin/consumo/ui";
import { formatoDiaComercial } from "@/lib/miles-presentacion";
import {
  ETIQUETA_ESTADO_PROPUESTA,
  ETIQUETA_ESTADO_PRUEBA,
  ETIQUETA_TIPO_PROMO,
  dinero,
  indicadoresPromo,
  metricaObservada,
  ordenAtencion,
} from "@/lib/promo-presentacion";
import { brand } from "@/lib/theme";

type Fila = Record<string, unknown>;

const TIPOS = [
  ["", "Cualquier tipo"],
  ["combo", "Combo"],
  ["acompanamiento", "Acompañamiento"],
  ["compra_minima", "Compra mínima"],
  ["horario", "Horario"],
  ["salida_inventario", "Salida de inventario"],
] as const;

const ESTADOS = [
  ["", "Cualquier estado"],
  ["borrador", "Borrador"],
  ["por_revisar", "Por revisar"],
  ["requiere_ampliacion", "Requiere ampliación"],
  ["lista_para_probar", "Lista para probar"],
  ["descartada", "Descartada"],
  ["archivada", "Archivada"],
] as const;

export function CombosVista({
  propuestas,
  disponibles,
  origen,
  pedirInicial,
  hallazgos,
}: {
  propuestas: Fila[];
  disponibles: boolean;
  origen: string;
  pedirInicial: boolean;
  hallazgos: Fila[];
}) {
  const router = useRouter();
  const [pedir, setPedir] = useState(pedirInicial);
  const [objetivo, setObjetivo] = useState("");
  const [filtroObjetivo, setFiltroObjetivo] = useState("");
  const [productos, setProductos] = useState("");
  const [categorias, setCategorias] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [restricciones, setRestricciones] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [tienda, setTienda] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [solidez, setSolidez] = useState("");
  const [texto, setTexto] = useState("");
  const [indicador, setIndicador] = useState("");
  const hallazgo = hallazgos.find((row) => String(row.id) === origen);
  const cuentas = indicadoresPromo(propuestas as Array<{ estado?: unknown; pruebas?: Array<{ estado?: unknown }>; evaluaciones?: unknown[] }>);

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return [...propuestas]
      .filter((row) => {
        if (tienda && String(row.tienda) !== tienda) return false;
        if (tipo && String(row.tipo) !== tipo) return false;
        if (estado && String(row.estado) !== estado) return false;
        if (filtroObjetivo && !String(row.objetivo).toLowerCase().includes(filtroObjetivo.trim().toLowerCase())) return false;
        const evidencia = objeto(row.evidencia);
        if (solidez && String(evidencia.solidez ?? "") !== solidez) return false;
        if (indicador === "revisar" && row.estado !== "por_revisar") return false;
        if (indicador === "prueba" && !pruebasDe(row).some((prueba) => prueba.estado === "en_curso")) return false;
        if (indicador === "evaluar" && !pruebasDe(row).some((prueba) => prueba.estado === "pendiente_evaluacion")) return false;
        if (indicador === "evaluadas" && evaluacionesDe(row).length === 0) return false;
        if (!q) return true;
        const productosFila = productosDe(row);
        const bolsa = [row.nombre, row.objetivo, ...productosFila.map((item) => `${item.nombre ?? ""} ${item.categoria ?? ""}`)].join(" ").toLowerCase();
        return bolsa.includes(q);
      })
      .sort((a, b) => ordenAtencion({ estado: a.estado, pruebas: pruebasDe(a) }) - ordenAtencion({ estado: b.estado, pruebas: pruebasDe(b) }));
  }, [propuestas, tienda, tipo, estado, filtroObjetivo, solidez, texto, indicador]);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setAviso(null);
    const respuesta = await fetch("/api/admin/miles/propuestas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objetivo,
        tienda: "quick",
        productos,
        categorias,
        desde,
        hasta,
        restricciones,
        hallazgoId: origen || null,
      }),
    });
    const json = await respuesta.json().catch(() => ({}));
    setEnviando(false);
    if (!respuesta.ok) {
      setAviso(json.error ?? "No se pudo dejar la solicitud");
      return;
    }
    setAviso(json.aviso ?? "Quedó pendiente.");
    setObjetivo("");
    setProductos("");
    setCategorias("");
    setRestricciones("");
    router.refresh();
  }

  if (!disponibles) {
    return <Vacio titulo="Combos y promos no están disponibles" detalle="Falta aplicar la migración de propuestas en este entorno. No hay propuestas de ejemplo." />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Combos y promos</h2>
          <p className="mt-1 text-sm text-brand-muted">Propuestas basadas en cómo compran tus clientes.</p>
        </div>
        <button type="button" onClick={() => setPedir((value) => !value)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>
          Pedir propuestas a Miles
        </button>
      </header>

      {pedir ? (
        <form onSubmit={enviar} className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4 md:grid-cols-2">
          <p className="text-sm text-brand-muted md:col-span-2">Esto deja una investigación pendiente. Miles no genera la propuesta al enviar el formulario.</p>
          {hallazgo ? <p className="text-sm md:col-span-2">Basada en el hallazgo «{String(hallazgo.titulo)}».</p> : null}
          <label className="text-xs text-brand-muted md:col-span-2">
            Objetivo
            <input required value={objetivo} onChange={(event) => setObjetivo(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-brand-ink" />
          </label>
          <label className="text-xs text-brand-muted">
            Tienda
            <select disabled className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-[#F8FAF7] px-3 py-2 text-sm" defaultValue="quick">
              <option value="quick">Quick!</option>
            </select>
          </label>
          <label className="text-xs text-brand-muted">
            Productos, opcional
            <input value={productos} onChange={(event) => setProductos(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-brand-ink" />
          </label>
          <label className="text-xs text-brand-muted">
            Categorías, opcional
            <input value={categorias} onChange={(event) => setCategorias(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-brand-ink" />
          </label>
          <label className="text-xs text-brand-muted">
            Periodo desde
            <input required type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-brand-muted">
            Periodo hasta
            <input required type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-brand-muted md:col-span-2">
            Restricciones o contexto
            <textarea value={restricciones} onChange={(event) => setRestricciones(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-brand-ink" />
          </label>
          <button type="submit" disabled={enviando} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2" style={{ backgroundColor: brand.green }}>
            {enviando ? "Enviando…" : "Dejar la solicitud"}
          </button>
          {aviso ? <p className="text-sm text-brand-muted md:col-span-2">{aviso}</p> : null}
        </form>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Indicador etiqueta="Por revisar" valor={cuentas.revisar} activo={indicador === "revisar"} onClick={() => setIndicador(indicador === "revisar" ? "" : "revisar")} />
        <Indicador etiqueta="En prueba" valor={cuentas.prueba} activo={indicador === "prueba"} onClick={() => setIndicador(indicador === "prueba" ? "" : "prueba")} />
        <Indicador etiqueta="Pendientes de evaluar" valor={cuentas.evaluar} activo={indicador === "evaluar"} onClick={() => setIndicador(indicador === "evaluar" ? "" : "evaluar")} />
        <Indicador etiqueta="Evaluadas" valor={cuentas.evaluadas} activo={indicador === "evaluadas"} onClick={() => setIndicador(indicador === "evaluadas" ? "" : "evaluadas")} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-brand-muted">
          Tienda
          <select value={tienda} onChange={(event) => setTienda(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm">
            <option value="">Quick! y cualquiera</option>
            <option value="quick">Quick!</option>
          </select>
        </label>
        <label className="text-xs text-brand-muted">
          Objetivo
          <input value={filtroObjetivo} onChange={(event) => setFiltroObjetivo(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-brand-muted">
          Tipo de promoción
          <select value={tipo} onChange={(event) => setTipo(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm">
            {TIPOS.map(([id, label]) => <option key={id || "todos"} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs text-brand-muted">
          Estado
          <select value={estado} onChange={(event) => setEstado(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm">
            {ESTADOS.map(([id, label]) => <option key={id || "todos"} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs text-brand-muted">
          Producto o categoría
          <input value={texto} onChange={(event) => setTexto(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-brand-muted">
          Solidez de evidencia
          <select value={solidez} onChange={(event) => setSolidez(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm">
            <option value="">Cualquiera</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </label>
      </div>

      {visibles.length === 0 ? (
        <Vacio
          titulo={propuestas.length === 0 ? "Miles todavía no ha publicado propuestas" : "Nada coincide con estos filtros"}
          detalle={propuestas.length === 0 ? "Pedir propuestas deja una investigación pendiente. No carga ejemplos ni genera combos al instante." : "Prueba con otros filtros. El orden no usa un beneficio estimado."}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((row) => <Tarjeta key={String(row.id)} row={row} />)}
        </div>
      )}
    </div>
  );
}

function Tarjeta({ row }: { row: Fila }) {
  const productos = productosDe(row);
  const evidencia = objeto(row.evidencia);
  const mecanica = objeto(row.mecanica);
  const metrica = metricaObservada(row.metricas);
  const habitual = precioHabitual(productos);
  const condicion = condicionPropuesta(productos, mecanica);
  return (
    <article className="flex flex-col rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pildora tono="gris">{ETIQUETA_TIPO_PROMO[String(row.tipo)] ?? String(row.tipo)}</Pildora>
        <Pildora tono={row.estado === "descartada" ? "rojo" : "naranja"}>{ETIQUETA_ESTADO_PROPUESTA[String(row.estado)] ?? String(row.estado)}</Pildora>
      </div>
      <h3 className="mt-2 text-base font-semibold">{String(row.nombre)}</h3>
      <p className="mt-1 text-sm text-brand-muted">{String(row.objetivo)}</p>
      <ul className="mt-3 space-y-2">
        {productos.map((producto) => (
          <li key={String(producto.productId)} className="flex items-center gap-2">
            <FotoProducto src={producto.fotoUrl ? String(producto.fotoUrl) : null} size="lista" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{String(producto.nombre ?? "Producto")}</span>
              <span className="block text-xs text-brand-muted">{producto.presentacion ? String(producto.presentacion) : "Sin presentación indicada"}</span>
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">Precio habitual</dt>
          <dd>{habitual == null ? "No disponible" : dinero(habitual)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">Condición</dt>
          <dd className="text-right">{condicion}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Dato observado</dt>
          <dd className="mt-0.5">{metrica ? `${metrica.nombre}: ${metrica.valor}` : "No disponible"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Solidez {String(evidencia.solidez ?? "no indicada")}</dt>
          <dd className="mt-0.5 text-brand-muted">{evidencia.fundamento ? String(evidencia.fundamento) : "Sin fundamento"}</dd>
        </div>
      </dl>
      {pruebasDe(row).length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-brand-muted">
          {pruebasDe(row).map((prueba) => (
            <li key={String(prueba.id)}>Prueba {ETIQUETA_ESTADO_PRUEBA[String(prueba.estado)] ?? String(prueba.estado)}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-brand-muted">{formatoDiaComercial(row.periodo_desde)} a {formatoDiaComercial(row.periodo_hasta)}</p>
      <Link href={`/admin/consumo/miles/propuestas/${row.id}`} className="mt-3 inline-flex w-fit rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>
        Explorar propuesta
      </Link>
    </article>
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

function productosDe(row: Fila): Fila[] {
  return Array.isArray(row.productos) ? (row.productos as Fila[]) : [];
}

function pruebasDe(row: Fila): Fila[] {
  return Array.isArray(row.pruebas) ? (row.pruebas as Fila[]) : [];
}

function evaluacionesDe(row: Fila): Fila[] {
  return Array.isArray(row.evaluaciones) ? (row.evaluaciones as Fila[]) : [];
}

function objeto(value: unknown): Fila {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fila) : {};
}

function precioHabitual(productos: Fila[]): number | null {
  if (productos.length === 0 || productos.some((producto) => producto.precio_habitual == null)) return null;
  return productos.reduce((total, producto) => total + Number(producto.precio_habitual) * Number(producto.cantidad), 0);
}

function condicionPropuesta(productos: Fila[], mecanica: Fila): string {
  if (mecanica.precioCombo != null) return `Combo ${dinero(mecanica.precioCombo)}`;
  if (mecanica.descuento != null) return `Descuento ${dinero(mecanica.descuento)}`;
  const promos = productos.filter((producto) => producto.precio_promo != null);
  if (promos.length > 0) return promos.map((producto) => `${producto.nombre}: ${dinero(producto.precio_promo)}`).join(" · ");
  if (mecanica.compraMinima != null) return `Compra mínima ${String(mecanica.compraMinima)}`;
  return "No indicada";
}
