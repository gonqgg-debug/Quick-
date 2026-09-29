"use client";

import { useEffect, useState } from "react";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/shell/DataTable";
import { AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/shell/AdminField";
import {
  FACTURA_ESTADOS,
  formatMonto,
  type FacturaDetalle,
  type FacturaEstado,
  type FacturaResumen,
  type FacturasResumen,
  type FacturaResultado,
} from "@/lib/contabilidad/facturas-shared";
import { evaluarLineaRecepcion } from "@/lib/inventario/costos";
import { brand } from "@/lib/theme";

type TabId = "resumen" | "productos" | "validaciones" | "preguntas" | "documento" | "inventario";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "productos", label: "Productos" },
  { id: "validaciones", label: "Validaciones" },
  { id: "preguntas", label: "Preguntas y respuestas" },
  { id: "documento", label: "Documento original" },
  { id: "inventario", label: "Inventario" },
];

function fechaCorta(value: string | null): string {
  if (!value) {
    return "—";
  }
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function fechaHora(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function estadoStyle(estado: FacturaEstado): { backgroundColor: string; color: string } {
  if (estado === "completa") {
    return { backgroundColor: brand.paleGreen, color: "#3F6212" };
  }
  if (estado === "pendiente_informacion" || estado === "posible_duplicado") {
    return { backgroundColor: brand.paleOrange, color: "#9A3412" };
  }
  if (estado === "documento_no_valido" || estado === "incompleta") {
    return { backgroundColor: "#FEE2E2", color: "#991B1B" };
  }
  if (estado === "escalada") {
    return { backgroundColor: "#E8EEF8", color: brand.navy };
  }
  return { backgroundColor: brand.paleBlue, color: brand.blue };
}

function resultadoStyle(resultado: FacturaResultado): { backgroundColor: string; color: string } {
  if (resultado === "correcto") {
    return { backgroundColor: brand.paleGreen, color: "#3F6212" };
  }
  if (resultado === "diferencia") {
    return { backgroundColor: "#FEE2E2", color: "#991B1B" };
  }
  if (resultado === "no_aplica") {
    return { backgroundColor: "#F3F4F6", color: brand.muted };
  }
  return { backgroundColor: brand.paleOrange, color: "#9A3412" };
}

function estadoCorto(estado: FacturaEstado): string {
  return FACTURA_ESTADOS.find((item) => item.id === estado)?.corto ?? estado;
}

function Pill({ label, style }: { label: string; style: { backgroundColor: string; color: string } }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={style}>
      {label}
    </span>
  );
}

function fotoLabel(factura: FacturaResumen): string {
  if (!factura.tieneFoto) {
    return "Sin foto";
  }
  return factura.numeroDocumentos === 1 ? "1 foto" : `${factura.numeroDocumentos} páginas`;
}

export function AdminFacturas() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [pendientes, setPendientes] = useState(false);
  const [duplicados, setDuplicados] = useState(false);
  const [sinFoto, setSinFoto] = useState(false);
  const [facturas, setFacturas] = useState<FacturaResumen[]>([]);
  const [resumen, setResumen] = useState<FacturasResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set("q", q.trim());
      }
      if (estado) {
        params.set("estado", estado);
      }
      if (pendientes) {
        params.set("pendientes", "true");
      }
      if (duplicados) {
        params.set("duplicados", "true");
      }
      if (sinFoto) {
        params.set("sinFoto", "true");
      }
      const query = params.toString();
      setLoading(true);
      void fetch(`/api/admin/facturas${query ? `?${query}` : ""}`, { credentials: "include" })
        .then(async (response) => {
          const body = (await response.json()) as { facturas?: FacturaResumen[]; resumen?: FacturasResumen; error?: string };
          if (!response.ok) {
            throw new Error(body.error || "No pudimos cargar las facturas");
          }
          if (!cancelled) {
            setFacturas(body.facturas ?? []);
            setResumen(body.resumen ?? null);
            setError(null);
          }
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setError(reason instanceof Error ? reason.message : "No pudimos cargar las facturas");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, estado, pendientes, duplicados, sinFoto, reloadKey]);

  const enAnalisis = (resumen?.porEstado ?? []).filter((item) => item.id === "recibida" || item.id === "en_analisis").reduce((sum, item) => sum + item.facturas, 0);
  const pendientesInfo = resumen?.porEstado.find((item) => item.id === "pendiente_informacion")?.facturas ?? 0;
  const completas = resumen?.porEstado.find((item) => item.id === "completa")?.facturas ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Facturas</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">
            Lo que Phillip va leyendo, con la foto original. Completa significa que ya capturó y validó el documento, no que esté en Odoo.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="En análisis" value={enAnalisis} />
        <Metric label="Pendientes" value={pendientesInfo} />
        <Metric label="Completas" value={completas} />
        <button type="button" onClick={() => setSinFoto((current) => !current)} className="rounded-2xl px-4 py-3 text-left" style={{ backgroundColor: sinFoto ? brand.paleOrange : "#fff", border: "1px solid #E7EBE4" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Sin foto</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums">{resumen?.sinFoto ?? "—"}</p>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <AdminInput bare value={q} onChange={(event) => setQ(event.target.value)} placeholder="Proveedor, NCF, número o tienda" aria-label="Buscar factura" />
        </div>
        <div className="w-52">
          <AdminSelect bare value={estado} onChange={(event) => setEstado(event.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            {FACTURA_ESTADOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.corto}
              </option>
            ))}
          </AdminSelect>
        </div>
        <FilterToggle pressed={pendientes} onClick={() => setPendientes((current) => !current)} label="Preguntas abiertas" />
        <FilterToggle pressed={duplicados} onClick={() => setDuplicados((current) => !current)} label="Posible duplicado" />
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        ) : facturas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E7EBE4] px-6 py-16 text-center">
            <p className="font-display text-lg font-bold">Todavía no hay facturas</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">Cuando Phillip reciba una foto, la guarda aquí con el proveedor, la tienda y el detalle de productos.</p>
          </div>
        ) : (
          <DataTable tableClassName="min-w-[980px]">
            <DataTableHead>
              <DataTableTh>Proveedor</DataTableTh>
              <DataTableTh>Fecha</DataTableTh>
              <DataTableTh>Tienda</DataTableTh>
              <DataTableTh>NCF / número</DataTableTh>
              <DataTableTh numeric>Total</DataTableTh>
              <DataTableTh numeric>Productos</DataTableTh>
              <DataTableTh>Foto</DataTableTh>
              <DataTableTh>Estado</DataTableTh>
              <DataTableTh>Inventario</DataTableTh>
              <DataTableTh numeric>Preguntas</DataTableTh>
              <DataTableTh>Duplicado</DataTableTh>
              <DataTableTh>Actualización</DataTableTh>
            </DataTableHead>
            <tbody>
              {facturas.map((factura) => (
                <DataTableRow key={factura.id} onClick={() => setOpenId(factura.id)}>
                  <DataTableCell>
                    <p className="font-semibold">{factura.proveedor || "Sin proveedor"}</p>
                    <p className="mt-0.5 text-xs text-brand-muted">{factura.tipoDocumentoLabel}</p>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap">{fechaCorta(factura.fechaEmision ?? factura.recibidoEn)}</DataTableCell>
                  <DataTableCell>{factura.tienda || "—"}</DataTableCell>
                  <DataTableCell>
                    <p>{factura.ncf || "—"}</p>
                    {factura.numeroFactura ? <p className="mt-0.5 text-xs text-brand-muted">{factura.numeroFactura}</p> : null}
                  </DataTableCell>
                  <DataTableCell numeric>{formatMonto(factura.total, factura.moneda)}</DataTableCell>
                  <DataTableCell numeric>{factura.numeroProductos}</DataTableCell>
                  <DataTableCell>
                    <span className="font-semibold" style={{ color: factura.tieneFoto ? "#3F6212" : "#9A3412" }}>
                      {fotoLabel(factura)}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <Pill label={estadoCorto(factura.estado)} style={estadoStyle(factura.estado)} />
                  </DataTableCell>
                  <DataTableCell>
                    <Pill label={factura.inventarioEstado} style={estadoStyle(factura.inventarioEstado === "aplicada" ? "completa" : factura.inventarioEstado === "parcial" ? "pendiente_informacion" : "recibida")} />
                  </DataTableCell>
                  <DataTableCell numeric>
                    <span style={{ color: factura.preguntasAbiertas > 0 ? "#9A3412" : undefined, fontWeight: factura.preguntasAbiertas > 0 ? 700 : 500 }}>
                      {factura.preguntasAbiertas}
                    </span>
                  </DataTableCell>
                  <DataTableCell>{factura.posibleDuplicado ? <Pill label="Sí" style={resultadoStyle("diferencia")} /> : "—"}</DataTableCell>
                  <DataTableCell className="whitespace-nowrap">{fechaHora(factura.actualizadoEn)}</DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>

      {openId ? (
        <FacturaDrawer
          facturaId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => setReloadKey((current) => current + 1)}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3" style={{ border: "1px solid #E7EBE4" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function FilterToggle({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 text-sm font-semibold"
      style={{ minHeight: 40, backgroundColor: pressed ? brand.ink : "#fff", color: pressed ? "#fff" : brand.ink, border: "1px solid #E7EBE4" }}
      aria-pressed={pressed}
    >
      {label}
    </button>
  );
}

function FacturaDrawer({ facturaId, onClose, onChanged }: { facturaId: string; onClose: () => void; onChanged: () => void }) {
  const [factura, setFactura] = useState<FacturaDetalle | null>(null);
  const [tab, setTab] = useState<TabId>("resumen");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch(`/api/admin/facturas/${facturaId}`, { credentials: "include" });
    const body = (await response.json()) as { factura?: FacturaDetalle; error?: string };
    if (!response.ok || !body.factura) {
      throw new Error(body.error || "No pudimos abrir la factura");
    }
    setFactura(body.factura);
    setError(null);
  }

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No pudimos abrir la factura"));
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // The drawer loads once per invoice. Later saves call load directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturaId]);

  async function guardarRevision(next: { estado?: string; observaciones?: string }) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/facturas/${facturaId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = (await response.json()) as { factura?: FacturaDetalle; error?: string };
      if (!response.ok || !body.factura) {
        throw new Error(body.error || "No pudimos guardar");
      }
      setFactura(body.factura);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar");
    } finally {
      setSaving(false);
    }
  }

  const abiertas = factura?.preguntas.filter((pregunta) => pregunta.estado === "abierta").length ?? 0;

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/35" aria-label="Cerrar" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative z-10 flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white" style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)" }}>
        <div className="border-b border-[#E7EBE4] px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Factura</p>
          <h2 className="font-display mt-1 text-2xl font-bold">{factura?.referencia ?? "Abriendo…"}</h2>
          {factura ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill label={estadoCorto(factura.estado)} style={estadoStyle(factura.estado)} />
              <Pill label={factura.tieneFoto ? fotoLabel(factura) : "Sin foto"} style={factura.tieneFoto ? { backgroundColor: brand.paleGreen, color: "#3F6212" } : { backgroundColor: brand.paleOrange, color: "#9A3412" }} />
              {factura.posibleDuplicado ? <Pill label="Posible duplicado" style={resultadoStyle("diferencia")} /> : null}
            </div>
          ) : null}
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-[#E7EBE4] px-4">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="shrink-0 border-b-2 px-3 py-3 text-sm font-semibold"
              style={{ borderColor: tab === item.id ? brand.green : "transparent", color: tab === item.id ? brand.ink : brand.muted }}
            >
              {item.label}
              {item.id === "preguntas" && abiertas > 0 ? ` (${abiertas})` : ""}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
              {error}
            </p>
          ) : null}
          {!factura ? <div className="h-40 animate-pulse rounded-2xl bg-[#F3F4F6]" /> : null}
          {factura && tab === "resumen" ? <Resumen factura={factura} saving={saving} onSave={guardarRevision} /> : null}
          {factura && tab === "productos" ? <Productos factura={factura} onChanged={load} /> : null}
          {factura && tab === "validaciones" ? <Validaciones factura={factura} /> : null}
          {factura && tab === "preguntas" ? <Preguntas factura={factura} onAnswered={async () => { await load(); onChanged(); }} /> : null}
          {factura && tab === "documento" ? <Documento factura={factura} /> : null}
          {factura && tab === "inventario" ? <InventarioTab factura={factura} onChanged={async () => { await load(); onChanged(); }} /> : null}
        </div>
      </div>
    </div>
  );
}

function Resumen({
  factura,
  saving,
  onSave,
}: {
  factura: FacturaDetalle;
  saving: boolean;
  onSave: (next: { estado?: string; observaciones?: string }) => Promise<void>;
}) {
  const [observaciones, setObservaciones] = useState(factura.observaciones ?? "");
  const primeraFoto = factura.documentos.find((doc) => doc.esImagen) ?? factura.documentos[0];
  return (
    <div className="space-y-5">
      {factura.posibleDuplicado ? (
        <p className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: brand.paleOrange, color: "#9A3412" }}>
          Posible duplicado{factura.duplicadoReferencia ? `: ${factura.duplicadoReferencia}` : ""}.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          {primeraFoto?.esImagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/admin/facturas/${factura.id}/documentos/${primeraFoto.id}`} alt="Foto de la factura" className="h-44 w-full rounded-2xl border border-[#E7EBE4] object-cover" />
          ) : (
            <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-[#E7EBE4] px-3 text-center text-sm text-brand-muted">
              {factura.tieneFoto ? "El original es un PDF. Ábrelo en Documento original." : "Sin foto todavía."}
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Dato label="Proveedor" value={factura.proveedor} />
          <Dato label="Tienda" value={factura.tienda} />
          <Dato label="RNC" value={factura.rnc} />
          <Dato label="NCF" value={factura.ncf} />
          <Dato label="Número" value={factura.numeroFactura} />
          <Dato label="Tipo" value={factura.tipoDocumentoLabel} />
          <Dato label="Emisión" value={fechaCorta(factura.fechaEmision)} />
          <Dato label="Vencimiento" value={fechaCorta(factura.fechaVencimiento)} />
          <Dato label="Recibida" value={fechaHora(factura.recibidoEn)} />
          <Dato label="Envió" value={factura.enviadoPor} />
          <Dato label="Condición" value={factura.condicionLabel} />
          <Dato label="Método de pago" value={factura.metodoPago} />
          <Dato label="Subtotal" value={formatMonto(factura.subtotal, factura.moneda)} />
          <Dato label="Descuento" value={formatMonto(factura.descuentoTotal, factura.moneda)} />
          <Dato label="ITBIS" value={formatMonto(factura.itbisTotal, factura.moneda)} />
          <Dato label="Otros cargos" value={formatMonto(factura.otrosCargos, factura.moneda)} />
          <Dato label="Total" value={formatMonto(factura.total, factura.moneda)} />
          <Dato label="Productos" value={String(factura.numeroProductos)} />
        </dl>
      </div>
      <label className="block text-sm">
        <span className="font-semibold">Estado</span>
        <AdminSelect
          value={factura.estado}
          disabled={saving}
          onChange={(event) => void onSave({ estado: event.target.value })}
          aria-label="Estado de la factura"
        >
          {FACTURA_ESTADOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </AdminSelect>
        <span className="mt-1 block text-xs text-brand-muted">{factura.estadoAyuda}</span>
      </label>
      <label className="block text-sm">
        <span className="font-semibold">Observaciones</span>
        <AdminTextarea value={observaciones} onChange={(event) => setObservaciones(event.target.value)} rows={3} />
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={() => void onSave({ observaciones })}
        className="rounded-full px-4 text-sm font-bold text-white"
        style={{ minHeight: 40, backgroundColor: brand.green }}
      >
        Guardar observaciones
      </button>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value && value !== "—" ? value : "—"}</dd>
    </div>
  );
}

function Productos({ factura, onChanged }: { factura: FacturaDetalle; onChanged: () => Promise<void> }) {
  if (!factura.lineas.length) {
    return <p className="text-sm text-brand-muted">Phillip todavía no extrajo productos.</p>;
  }
  return (
    <ul className="space-y-3">
      {factura.lineas.map((linea) => {
        const detalle = [linea.productoNormalizado, linea.marca, linea.variante, linea.tamano, linea.codigoSku].filter(Boolean).join(" · ");
        return (
          <li key={linea.id} className="rounded-2xl border border-[#E7EBE4] bg-white px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: "#F3F4F6", color: brand.ink }}>
                {linea.numeroLinea}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold leading-snug">{linea.descripcionOriginal || linea.codigoSku || "Sin descripción"}</p>
                  <span className="shrink-0 text-xs font-semibold text-brand-muted">{linea.estadoLabel}</span>
                </div>
                {detalle ? <p className="mt-1 text-xs leading-relaxed text-brand-muted">{detalle}</p> : null}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <LineaDato label="Presentación" value={linea.presentacionLabel} />
              <LineaDato label="Cantidad" value={linea.cantidadComprada == null ? null : String(linea.cantidadComprada)} />
              <LineaDato label="Unidades" value={linea.unidadesTotales == null ? null : String(linea.unidadesTotales)} />
              <LineaDato label="Total" value={formatMonto(linea.totalLinea, factura.moneda)} />
            </dl>
            <p className="mt-2 text-xs text-brand-muted">Costo {formatMonto(linea.costoPorPresentacion, factura.moneda)} por presentación</p>
            {linea.observacion ? <p className="mt-2 text-xs leading-relaxed" style={{ color: "#9A3412" }}>{linea.observacion}</p> : null}
            <CatalogoLinea facturaId={factura.id} linea={linea} onChanged={onChanged} />
          </li>
        );
      })}
    </ul>
  );
}

function LineaDato({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value && value !== "—" ? value : "—"}</dd>
    </div>
  );
}

type CatalogoOpcion = {
  id: string;
  nombre: string;
  marca: string | null;
  codigoOdoo: string | null;
};

function CatalogoLinea({
  facturaId,
  linea,
  onChanged,
}: {
  facturaId: string;
  linea: FacturaDetalle["lineas"][number];
  onChanged: () => Promise<void>;
}) {
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
            setError(reason instanceof Error ? reason.message : "No pudimos buscar en el catálogo");
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
      const response = await fetch(`/api/admin/facturas/${facturaId}/lineas/${linea.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "No pudimos enlazar el producto");
      }
      setOpen(false);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos enlazar el producto");
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

function Validaciones({ factura }: { factura: FacturaDetalle }) {
  return (
    <ul className="space-y-3">
      {factura.validaciones.map((validacion) => (
        <li key={validacion.codigo} className="rounded-2xl border border-[#E7EBE4] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{validacion.codigoLabel}</p>
            <Pill label={validacion.resultadoLabel} style={resultadoStyle(validacion.resultado)} />
          </div>
          <p className="mt-2 text-sm text-brand-muted">{validacion.explicacion || "Sin explicación."}</p>
          <p className="mt-1 text-xs text-brand-muted">{validacion.revisadoEn ? fechaHora(validacion.revisadoEn) : "Sin revisión"}</p>
        </li>
      ))}
    </ul>
  );
}

function Preguntas({ factura, onAnswered }: { factura: FacturaDetalle; onAnswered: () => Promise<void> }) {
  if (!factura.preguntas.length) {
    return <p className="text-sm text-brand-muted">No hay preguntas sobre esta factura.</p>;
  }
  return (
    <ul className="space-y-4">
      {factura.preguntas.map((pregunta) => (
        <li key={pregunta.id} className="rounded-2xl border border-[#E7EBE4] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{pregunta.campo || "Documento"}{pregunta.lineaNumero ? ` · línea ${pregunta.lineaNumero}` : ""}</p>
            <Pill label={pregunta.estadoLabel} style={pregunta.estado === "abierta" ? resultadoStyle("pendiente") : resultadoStyle("correcto")} />
          </div>
          <p className="mt-2 font-semibold">{pregunta.pregunta}</p>
          <p className="mt-1 text-xs text-brand-muted">Consultó a {pregunta.consultadoA || "alguien"} · {fechaHora(pregunta.creadoEn)}</p>
          {pregunta.respuesta ? (
            <div className="mt-3 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: brand.paleGreen }}>
              <p>{pregunta.respuesta}</p>
              <p className="mt-1 text-xs text-brand-muted">
                {pregunta.respondidoPor || "Sin nombre"} · {fechaHora(pregunta.respondidoEn)}
              </p>
              {pregunta.evidencia ? <p className="mt-1 text-xs">{pregunta.evidencia}</p> : null}
            </div>
          ) : (
            <RespuestaForm facturaId={factura.id} preguntaId={pregunta.id} onAnswered={onAnswered} />
          )}
        </li>
      ))}
    </ul>
  );
}

function RespuestaForm({ facturaId, preguntaId, onAnswered }: { facturaId: string; preguntaId: string; onAnswered: () => Promise<void> }) {
  const [respuesta, setRespuesta] = useState("");
  const [respondidoPor, setRespondidoPor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/facturas/${facturaId}/preguntas/${preguntaId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuesta, respondidoPor }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "No pudimos guardar la respuesta");
      }
      await onAnswered();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar la respuesta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <AdminTextarea value={respuesta} onChange={(event) => setRespuesta(event.target.value)} rows={2} placeholder="Respuesta" aria-label="Respuesta" />
      <AdminInput value={respondidoPor} onChange={(event) => setRespondidoPor(event.target.value)} placeholder="Quién respondió" aria-label="Quién respondió" />
      {error ? <p className="text-sm" style={{ color: brand.error }}>{error}</p> : null}
      <button type="button" disabled={saving || !respuesta.trim()} onClick={() => void submit()} className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-50" style={{ minHeight: 40, backgroundColor: brand.navy }}>
        Guardar respuesta
      </button>
    </div>
  );
}

function Documento({ factura }: { factura: FacturaDetalle }) {
  if (!factura.documentos.length) {
    return <p className="text-sm text-brand-muted">Phillip todavía no subió la foto o el PDF de esta factura.</p>;
  }
  return (
    <ul className="space-y-4">
      {factura.documentos.map((documento) => {
        const src = `/api/admin/facturas/${factura.id}/documentos/${documento.id}`;
        return (
          <li key={documento.id} className="overflow-hidden rounded-2xl border border-[#E7EBE4]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-sm font-semibold">{documento.nombre || (documento.pagina ? `Página ${documento.pagina}` : "Documento original")}</p>
              <a href={src} target="_blank" rel="noreferrer" className="text-sm font-bold" style={{ color: brand.blue }}>
                Abrir
              </a>
            </div>
            {documento.esImagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={documento.nombre || "Foto de la factura"} className="max-h-[640px] w-full bg-[#F7F8F6] object-contain" />
            ) : (
              <iframe title={documento.nombre || "PDF de la factura"} src={src} className="h-[640px] w-full bg-[#F7F8F6]" />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function InventarioTab({ factura, onChanged }: { factura: FacturaDetalle; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const lineas = factura.lineas.map((linea) => ({
    linea,
    evaluada: evaluarLineaRecepcion({
      productoId: linea.productoId,
      unidadesTotales: linea.unidadesTotales,
      cantidadComprada: linea.cantidadComprada,
      presentacion: linea.presentacion,
      costoUnitario: linea.costoUnitario,
      costoPorPresentacion: linea.costoPorPresentacion,
    }),
  }));

  async function aplicar() {
    setBusy(true);
    setError(null);
    setResultado(null);
    try {
      const response = await fetch(`/api/admin/facturas/${factura.id}/inventario`, { method: "POST", credentials: "include" });
      const body = (await response.json()) as { error?: string; inventario?: { aplicadas: unknown[]; omitidas: unknown[]; yaAplicadas: number; estado: string } };
      if (!response.ok || !body.inventario) {
        throw new Error(body.error || "No pudimos aplicar la factura");
      }
      setResultado(`Estado ${body.inventario.estado}. Nuevas: ${body.inventario.aplicadas.length}. Omitidas: ${body.inventario.omitidas.length}. Ya estaban: ${body.inventario.yaAplicadas}.`);
      await onChanged();
    } catch (aplicarError) {
      setError(aplicarError instanceof Error ? aplicarError.message : "No pudimos aplicar la factura");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Estado: {factura.inventarioEstado}</p>
          {factura.compraId ? (
            <a href="/admin/contabilidad/compras" className="text-sm font-bold" style={{ color: brand.green }}>
              Ver cuenta por pagar
            </a>
          ) : (
            <p className="text-sm text-brand-muted">Todavía no hay cuenta por pagar enlazada.</p>
          )}
        </div>
        <button type="button" disabled={busy} onClick={() => void aplicar()} className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-50" style={{ minHeight: 40, backgroundColor: brand.navy }}>
          {busy ? "Aplicando…" : "Aplicar al inventario"}
        </button>
      </div>
      {error ? <p className="text-sm" style={{ color: brand.error }}>{error}</p> : null}
      {resultado ? <p className="text-sm font-semibold">{resultado}</p> : null}
      <ul className="space-y-2">
        {lineas.map(({ linea, evaluada }) => (
          <li key={linea.id} className="rounded-2xl border border-[#E7EBE4] px-4 py-3 text-sm">
            <p className="font-semibold">Línea {linea.numeroLinea}. {linea.productoNormalizado || linea.descripcionOriginal || "Sin descripción"}</p>
            <p className="mt-1 text-brand-muted">
              {evaluada.ok ? `${evaluada.unidades} unidades a ${evaluada.costoUnitario}` : evaluada.motivo}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
