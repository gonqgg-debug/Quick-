"use client";

import { useEffect, useState } from "react";
import { AdminInput, AdminSelect } from "@/components/admin/AdminField";
import {
  FACTURA_RECEPCIONES,
  PROPUESTA_ACEPTAR_TODAS,
  PROPUESTA_UMBRAL,
  formatMonto,
  resumenRecepcion,
  type FacturaDetalle,
  type FacturaLinea,
  type FacturaRecepcion,
} from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";
import { mensajeDe, type EnviarFactura } from "@/components/admin/facturas/useFactura";
import { Dato, Seccion, TONO, Pill, type PillTone } from "@/components/admin/facturas/ui";

const RECEPCION_TONO: Record<FacturaRecepcion, PillTone> = {
  pendiente: TONO.gris,
  completa: TONO.verde,
  faltante: TONO.rojo,
  regalo: TONO.azul,
};

export function Productos({ factura, enviar }: { factura: FacturaDetalle; enviar: EnviarFactura }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinCatalogo = factura.lineas.filter((linea) => !linea.productoCatalogo).length;
  const aceptables = factura.lineas.filter((linea) => !linea.productoId && (linea.propuesta?.confianza ?? 0) >= PROPUESTA_ACEPTAR_TODAS).length;
  const deAgente = factura.lineas.filter((linea) => !linea.productoId && linea.propuesta?.origen === "agente").length;
  const recepcion = resumenRecepcion(factura.lineas);

  async function aceptarTodas() {
    setAceptando(true);
    setError(null);
    try {
      await enviar("/lineas/aceptar", "POST", {});
    } catch (reason) {
      setError(mensajeDe(reason, "No pudimos aceptar las propuestas"));
    } finally {
      setAceptando(false);
    }
  }

  return (
    <Seccion
      id="productos"
      titulo={`Productos (${factura.lineas.length})`}
      extra={
        <div className="flex flex-wrap items-center gap-1">
          {sinCatalogo > 0 ? <Pill label={`${sinCatalogo} sin catálogo`} tone={TONO.naranja} /> : null}
          {deAgente > 0 ? <Pill label={`${deAgente} propuestas de Phillip`} tone={TONO.azul} /> : null}
          {recepcion.sinConfirmar > 0 && !factura.esCompraPersonal ? <Pill label={`${recepcion.sinConfirmar} sin recepción`} tone={TONO.gris} /> : null}
        </div>
      }
    >
      {aceptables > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: brand.paleBlue }}>
          <span>
            {aceptables === 1 ? "Una línea tiene" : `${aceptables} líneas tienen`} propuesta de {PROPUESTA_ACEPTAR_TODAS}% o más.
          </span>
          <button
            type="button"
            disabled={aceptando}
            onClick={() => void aceptarTodas()}
            className="rounded-full px-3 text-xs font-bold text-white disabled:opacity-50"
            style={{ minHeight: 32, backgroundColor: brand.navy }}
          >
            {aceptando ? "Aceptando…" : `Aceptar ${aceptables === 1 ? "la propuesta" : `las ${aceptables}`}`}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="mb-2 text-xs" style={{ color: brand.error }}>
          {error}
        </p>
      ) : null}
      {!factura.lineas.length ? (
        <p className="text-sm text-brand-muted">Phillip todavía no extrajo productos.</p>
      ) : (
        <ul className="divide-y divide-[#F1F5F9] overflow-hidden rounded-xl border border-[#E7EBE4]">
          {factura.lineas.map((linea) => (
            <Linea
              key={linea.id}
              factura={factura}
              linea={linea}
              abierta={abierta === linea.id}
              onToggle={() => setAbierta((current) => (current === linea.id ? null : linea.id))}
              enviar={enviar}
            />
          ))}
        </ul>
      )}
    </Seccion>
  );
}

function Linea({
  factura,
  linea,
  abierta,
  onToggle,
  enviar,
}: {
  factura: FacturaDetalle;
  linea: FacturaLinea;
  abierta: boolean;
  onToggle: () => void;
  enviar: EnviarFactura;
}) {
  const monto = (value: number | null) => formatMonto(value, factura.moneda);
  const dudosa = linea.estado !== "completa";
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[#F7F8F6]"
      >
        <span className="text-xs font-bold tabular-nums text-brand-muted">{linea.numeroLinea}</span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{linea.descripcionOriginal || linea.codigoSku || "Sin descripción"}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-brand-muted">
            <span>{linea.cantidadComprada == null ? "—" : linea.cantidadComprada} {linea.presentacionLabel ?? ""}</span>
            <span style={{ color: linea.productoCatalogo ? "#3F6212" : "#9A3412" }}>
              {linea.productoCatalogo
                ? linea.productoCatalogo.nombre
                : linea.propuesta?.producto
                  ? `¿${linea.propuesta.producto.nombre}? ${linea.propuesta.confianza}%`
                  : "Sin catálogo"}
            </span>
            {dudosa ? <span style={{ color: "#9A3412" }}>{linea.estadoLabel}</span> : null}
            {linea.alertas.map((alerta) => (
              <span key={alerta.tipo} className="font-semibold" style={{ color: "#9A3412" }}>
                {alerta.tipo === "precio" ? "Precio" : "Cantidad"} {alerta.variacion > 0 ? "+" : "−"}
                {Math.round(Math.abs(alerta.variacion) * 100)}%
              </span>
            ))}
            {linea.recepcion === "faltante" || linea.recepcion === "regalo" ? (
              <span style={{ color: RECEPCION_TONO[linea.recepcion].color }}>
                {linea.recepcion === "faltante" ? `Llegaron ${linea.cantidadRecibida ?? 0}` : "Regalo"}
              </span>
            ) : null}
          </span>
        </span>
        <span className="whitespace-nowrap font-semibold tabular-nums">{monto(linea.totalLinea)}</span>
      </button>
      {abierta ? (
        <div className="border-t border-[#F1F5F9] bg-[#FBFCFA] px-3 py-3 sm:pl-[52px]">
          {[linea.productoNormalizado, linea.marca, linea.variante, linea.tamano, linea.codigoSku, linea.codigoBarras].some(Boolean) ? (
            <p className="text-xs leading-relaxed text-brand-muted">
              {[linea.productoNormalizado, linea.marca, linea.variante, linea.tamano, linea.codigoSku, linea.codigoBarras].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <Dato label="Presentación" value={linea.presentacionLabel} />
            <Dato label="Unidades" value={linea.unidadesTotales == null ? null : String(linea.unidadesTotales)} />
            <Dato label="Costo por presentación" value={monto(linea.costoPorPresentacion)} />
            <Dato label="Costo unitario" value={monto(linea.costoUnitario)} />
            <Dato label="Descuento" value={monto(linea.descuentoLinea)} />
            <Dato label="ITBIS" value={monto(linea.itbisLinea)} />
            <Dato label="Precio con ITBIS" value={linea.precioIncluyeItbisLabel} />
            <Dato label="Estado" value={linea.estadoLabel} />
          </dl>
          {linea.observacion ? <p className="mt-2 text-xs leading-relaxed" style={{ color: "#9A3412" }}>{linea.observacion}</p> : null}
          {linea.alertas.length ? (
            <ul className="mt-2 space-y-1 rounded-xl px-3 py-2 text-xs leading-relaxed" style={{ backgroundColor: "#FDF1DE", color: "#9A3412" }}>
              {linea.alertas.map((alerta) => (
                <li key={alerta.tipo}>{alerta.texto}</li>
              ))}
            </ul>
          ) : null}
          <RecepcionLinea factura={factura} linea={linea} enviar={enviar} />
          <CatalogoLinea linea={linea} enviar={enviar} />
          <PresentacionLinea factura={factura} linea={linea} enviar={enviar} />
        </div>
      ) : null}
    </li>
  );
}

type CatalogoOpcion = {
  id: string;
  nombre: string;
  marca: string | null;
  codigoOdoo: string | null;
};

function CatalogoLinea({ linea, enviar }: { linea: FacturaLinea; enviar: EnviarFactura }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(linea.codigoBarras || linea.productoNormalizado || linea.descripcionOriginal || "");
  const [opciones, setOpciones] = useState<CatalogoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vinculado = linea.productoCatalogo;
  const propuesta = linea.propuesta;

  useEffect(() => {
    if (!open) {
      return;
    }
    const query = q.trim();
    if (query.length < 2) {
      setOpciones([]);
      setBuscando(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setBuscando(true);
      void fetch(`/api/admin/catalogo/productos?q=${encodeURIComponent(query)}&estado=activo`, { credentials: "include" })
        .then(async (response) => {
          const body = (await response.json()) as { products?: CatalogoOpcion[]; error?: string };
          if (!response.ok) {
            throw new Error(body.error || "No pudimos buscar en el catálogo");
          }
          if (!cancelled) {
            setOpciones(body.products ?? []);
            setError(null);
          }
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setError(mensajeDe(reason, "No pudimos buscar en el catálogo"));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setBuscando(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, q]);

  async function elegir(productoId: string | null, aceptarPropuesta = false) {
    setGuardando(true);
    setError(null);
    try {
      await enviar(`/lineas/${linea.id}`, "PATCH", aceptarPropuesta ? { aceptarPropuesta: true } : { productoId });
      setOpen(false);
    } catch (reason) {
      setError(mensajeDe(reason, "No pudimos enlazar el producto"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[#E7EBE4] pt-3">
      <div className="flex items-center justify-between gap-3">
        {vinculado ? (
          <p className="min-w-0 text-sm font-semibold leading-snug" style={{ color: "#3F6212" }}>
            {vinculado.nombre}
            {vinculado.codigoOdoo ? <span className="mt-0.5 block text-xs font-medium text-brand-muted">{vinculado.codigoOdoo}</span> : null}
          </p>
        ) : propuesta ? (
          <p className="min-w-0 text-sm leading-snug">
            <span className="font-semibold">{propuesta.producto?.nombre ?? "Producto propuesto"}</span>
            <span className="mt-0.5 block text-xs" style={{ color: propuesta.confianza >= PROPUESTA_UMBRAL ? brand.navy : "#9A3412" }}>
              {propuesta.origen === "agente" ? `${propuesta.por ?? "Phillip"} propone` : "Propuesta"} {propuesta.confianza}%
              {propuesta.origen === "agente" ? "" : ` · ${propuesta.origenLabel}`}
              {propuesta.confianza < PROPUESTA_UMBRAL ? " · revisar" : ""}
            </span>
            {propuesta.razon ? <span className="mt-0.5 block text-xs leading-relaxed text-brand-muted">{propuesta.razon}</span> : null}
          </p>
        ) : (
          <p className="text-sm text-brand-muted">Sin producto del catálogo</p>
        )}
        <div className="flex shrink-0 gap-2">
          {!vinculado && propuesta ? (
            <button
              type="button"
              className="rounded-full px-3 text-xs font-bold text-white disabled:opacity-50"
              style={{ minHeight: 32, backgroundColor: brand.green }}
              disabled={guardando}
              onClick={() => void elegir(null, true)}
            >
              Aceptar
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-full px-3 text-xs font-bold"
            style={{ minHeight: 32, backgroundColor: brand.paleBlue, color: brand.navy }}
            onClick={() => setOpen((current) => !current)}
          >
            {vinculado ? "Cambiar" : "Elegir"}
          </button>
          {vinculado ? (
            <button type="button" className="rounded-full px-3 text-xs font-bold text-brand-muted" style={{ minHeight: 32 }} disabled={guardando} onClick={() => void elegir(null)}>
              Quitar
            </button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="mt-2 rounded-xl border border-[#E7EBE4] bg-white p-2">
          <AdminInput
            bare
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nombre, código o barras"
            aria-label={`Buscar producto del catálogo para la línea ${linea.numeroLinea}`}
          />
          {buscando ? <p className="mt-2 text-xs text-brand-muted">Buscando…</p> : null}
          {error ? <p className="mt-2 text-xs" style={{ color: brand.error }}>{error}</p> : null}
          <ul className="mt-1 max-h-48 overflow-y-auto">
            {opciones.map((opcion) => (
              <li key={opcion.id}>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void elegir(opcion.id)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#F7F8F6]"
                >
                  <span className="font-semibold">{opcion.nombre}</span>
                  <span className="mt-0.5 block text-brand-muted">{[opcion.marca, opcion.codigoOdoo].filter(Boolean).join(" · ") || "Sin código"}</span>
                </button>
              </li>
            ))}
          </ul>
          {!buscando && q.trim().length >= 2 && opciones.length === 0 && !error ? <p className="mt-2 text-xs text-brand-muted">Ningún producto coincide.</p> : null}
        </div>
      ) : error ? (
        <p className="mt-1 text-xs" style={{ color: brand.error }}>{error}</p>
      ) : null}
    </div>
  );
}

function RecepcionLinea({ factura, linea, enviar }: { factura: FacturaDetalle; linea: FacturaLinea; enviar: EnviarFactura }) {
  const [recepcion, setRecepcion] = useState<FacturaRecepcion>(linea.recepcion);
  const [cantidad, setCantidad] = useState(linea.cantidadRecibida == null ? "" : String(linea.cantidadRecibida));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRecepcion(linea.recepcion);
    setCantidad(linea.cantidadRecibida == null ? "" : String(linea.cantidadRecibida));
  }, [linea.recepcion, linea.cantidadRecibida]);

  const cambiado = recepcion !== linea.recepcion || (recepcion !== "completa" && cantidad !== (linea.cantidadRecibida == null ? "" : String(linea.cantidadRecibida)));

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await enviar("/recepcion", "POST", {
        lineas: [{ numeroLinea: linea.numeroLinea, recepcion, cantidadRecibida: recepcion === "completa" || cantidad.trim() === "" ? null : Number(cantidad) }],
      });
    } catch (reason) {
      setError(mensajeDe(reason, "No pudimos guardar la recepción"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[#E7EBE4] pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[140px] text-xs font-semibold text-brand-muted">
          Recepción
          <AdminSelect value={recepcion} onChange={(event) => setRecepcion(event.target.value as FacturaRecepcion)} className="mt-1">
            {FACTURA_RECEPCIONES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </AdminSelect>
        </label>
        {recepcion === "faltante" || recepcion === "regalo" ? (
          <label className="w-32 text-xs font-semibold text-brand-muted">
            Llegaron
            <AdminInput
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={cantidad}
              onChange={(event) => setCantidad(event.target.value)}
              placeholder={linea.cantidadComprada == null ? "0" : `de ${linea.cantidadComprada}`}
              className="mt-1"
            />
          </label>
        ) : null}
        {cambiado ? (
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            className="rounded-full px-3 text-xs font-bold text-white disabled:opacity-50"
            style={{ minHeight: 36, backgroundColor: brand.green }}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        ) : null}
      </div>
      {linea.recepcionEn && !cambiado ? (
        <p className="mt-1 text-xs text-brand-muted">
          {linea.recepcionPor ?? "Rodrigo"} · {new Date(linea.recepcionEn).toLocaleDateString("es-DO")}
          {linea.diferenciaRecepcion ? ` · faltan ${formatMonto(linea.diferenciaRecepcion, factura.moneda)}` : ""}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs" style={{ color: brand.error }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PresentacionLinea({ factura, linea, enviar }: { factura: FacturaDetalle; linea: FacturaLinea; enviar: EnviarFactura }) {
  const [unidades, setUnidades] = useState("");
  const [soloProveedor, setSoloProveedor] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!linea.productoCatalogo || !linea.presentacion || linea.presentacion === "unidad" || linea.unidadesPorPresentacion != null) {
    return null;
  }
  const productoId = linea.productoCatalogo.id;
  const presentacion = linea.presentacion;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await enviar("/api/admin/presentaciones", "POST", {
        productoId,
        presentacion,
        unidades: Number(unidades),
        proveedorId: soloProveedor ? factura.proveedorId : null,
      });
    } catch (reason) {
      setError(mensajeDe(reason, "No pudimos guardar la presentación"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[#E7EBE4] pt-3 text-sm">
      <p className="font-semibold">¿Cuántas unidades trae {linea.presentacionLabel?.toLowerCase() === "otra" ? "esta presentación" : `un ${linea.presentacionLabel?.toLowerCase() ?? "empaque"}`}?</p>
      <p className="mt-0.5 text-xs text-brand-muted">Queda guardado en el catálogo y completa unidades y costo unitario de esta y las próximas facturas.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="w-28">
          <AdminInput type="number" min={1} step="any" inputMode="decimal" value={unidades} onChange={(event) => setUnidades(event.target.value)} aria-label="Unidades por presentación" />
        </div>
        {factura.proveedorId ? (
          <label className="flex items-center gap-1.5 text-xs font-semibold">
            <input type="checkbox" checked={soloProveedor} onChange={(event) => setSoloProveedor(event.target.checked)} className="h-4 w-4 accent-[#7EB341]" />
            Solo de este proveedor
          </label>
        ) : null}
        <button
          type="button"
          disabled={guardando || !(Number(unidades) > 0)}
          onClick={() => void guardar()}
          className="rounded-full px-3 text-xs font-bold text-white disabled:opacity-50"
          style={{ minHeight: 32, backgroundColor: brand.green }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs" style={{ color: brand.error }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
