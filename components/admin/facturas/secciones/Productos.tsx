"use client";

import { useEffect, useState } from "react";
import { AdminInput } from "@/components/admin/AdminField";
import { formatMonto, type FacturaDetalle, type FacturaLinea } from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";
import { mensajeDe, type EnviarFactura } from "@/components/admin/facturas/useFactura";
import { Dato, Seccion, TONO, Pill } from "@/components/admin/facturas/ui";

export function Productos({ factura, enviar }: { factura: FacturaDetalle; enviar: EnviarFactura }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const sinCatalogo = factura.lineas.filter((linea) => !linea.productoCatalogo).length;
  return (
    <Seccion
      id="productos"
      titulo={`Productos (${factura.lineas.length})`}
      extra={sinCatalogo > 0 ? <Pill label={`${sinCatalogo} sin catálogo`} tone={TONO.naranja} /> : null}
    >
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
              {linea.productoCatalogo ? linea.productoCatalogo.nombre : "Sin catálogo"}
            </span>
            {dudosa ? <span style={{ color: "#9A3412" }}>{linea.estadoLabel}</span> : null}
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
          <CatalogoLinea linea={linea} enviar={enviar} />
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

  async function elegir(productoId: string | null) {
    setGuardando(true);
    setError(null);
    try {
      await enviar(`/lineas/${linea.id}`, "PATCH", { productoId });
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
        ) : (
          <p className="text-sm text-brand-muted">Sin producto del catálogo</p>
        )}
        <div className="flex shrink-0 gap-2">
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
