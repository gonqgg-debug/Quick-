"use client";

import { useState, type ReactNode } from "react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminField";
import { formatMonto, type FacturaDetalle } from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";
import { mensajeDe, type EnviarFactura } from "@/components/admin/facturas/useFactura";
import { Aviso, BotonPrincipal, BotonSecundario, Pill, Seccion, TONO, fechaCorta, fechaHora, pasoDeEtapa } from "@/components/admin/facturas/ui";

type Estado = "hecho" | "pendiente" | "problema";

export function Equipo({ factura, enviar }: { factura: FacturaDetalle; enviar: EnviarFactura }) {
  const paso = pasoDeEtapa(factura.estado);
  const rodrigo: Estado = factura.confirmacionEn || factura.esCompraPersonal ? "hecho" : "pendiente";
  const phillip: Estado = paso >= 1 ? "hecho" : "pendiente";
  const boris: Estado = factura.verificacion
    ? factura.verificacion.resultado === "cuadra"
      ? "hecho"
      : "problema"
    : paso >= 2
      ? "hecho"
      : "pendiente";
  const fred: Estado = factura.conciliacion
    ? factura.conciliacion.resultado === "pagada"
      ? "hecho"
      : "problema"
    : paso >= 3
      ? "hecho"
      : "pendiente";

  return (
    <Seccion id="equipo" titulo="Equipo">
      {factura.problema ? (
        <div className="mb-4">
          <Aviso>
            Con problema{factura.problemaDueno ? `, lo tiene ${factura.problemaDueno}` : ""} desde {fechaHora(factura.problemaDesde)}.
            {factura.problemaFalta ? ` ${factura.problemaFalta}` : ""}
          </Aviso>
        </div>
      ) : null}
      <ol className="relative space-y-5 border-l-2 border-[#E7EBE4] pl-5">
        <Paso nombre="Rodrigo" rol="Respuesta de la tienda y compra personal" estado={rodrigo}>
          <Rodrigo factura={factura} enviar={enviar} />
        </Paso>
        <Paso nombre="Phillip" rol="Registra los renglones" estado={phillip}>
          <p className="text-sm text-brand-muted">
            {phillip === "hecho"
              ? `Renglones listos: ${factura.numeroProductos} producto${factura.numeroProductos === 1 ? "" : "s"}.`
              : factura.esCompraPersonal || factura.confirmacionEn
                ? "Puede dejarla registrada cuando termine los renglones."
                : "Espera la respuesta de Ramón para dejarla registrada."}
          </p>
        </Paso>
        <Paso nombre="Boris" rol="Verifica RNC, NCF y montos" estado={boris}>
          {factura.verificacion ? (
            <div className="text-sm">
              <p className="font-semibold">
                {factura.verificacion.resultadoLabel} · {fechaHora(factura.verificacion.creadoEn)}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <Monto label="Factura" value={formatMonto(factura.verificacion.montoFactura, factura.moneda)} />
                <Monto label="Sistema" value={formatMonto(factura.verificacion.montoSistema, factura.moneda)} />
                <Monto label="Caja" value={formatMonto(factura.verificacion.montoCaja, factura.moneda)} />
                <Monto label="DGII" value={formatMonto(factura.verificacion.montoDgii, factura.moneda)} />
              </dl>
              {factura.verificacion.nota ? <p className="mt-2 text-brand-muted">{factura.verificacion.nota}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-brand-muted">Todavía no publica la revisión.</p>
          )}
        </Paso>
        <Paso nombre="Fred" rol="Concilia el pago" estado={fred}>
          {factura.conciliacion ? (
            <p className="text-sm">
              <span className="font-semibold">
                {factura.conciliacion.resultadoLabel}
                {factura.conciliacion.medioLabel ? ` por ${factura.conciliacion.medioLabel}` : ""}
                {factura.conciliacion.fecha ? ` el ${fechaCorta(factura.conciliacion.fecha)}` : ""}
              </span>
              {factura.conciliacion.nota ? <span className="mt-1 block text-brand-muted">{factura.conciliacion.nota}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-brand-muted">Todavía no publica la conciliación.</p>
          )}
        </Paso>
      </ol>
    </Seccion>
  );
}

function Paso({ nombre, rol, estado, children }: { nombre: string; rol: string; estado: Estado; children: ReactNode }) {
  const color = estado === "hecho" ? brand.green : estado === "problema" ? "#DC2626" : "#D1D5DB";
  const etiqueta = estado === "hecho" ? { label: "Listo", tone: TONO.verde } : estado === "problema" ? { label: "Con problema", tone: TONO.rojo } : { label: "Pendiente", tone: TONO.gris };
  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{nombre}</p>
        <span className="text-xs text-brand-muted">{rol}</span>
        <Pill label={etiqueta.label} tone={etiqueta.tone} />
      </div>
      <div className="mt-2">{children}</div>
    </li>
  );
}

function Monto({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Rodrigo({ factura, enviar }: { factura: FacturaDetalle; enviar: EnviarFactura }) {
  const [editando, setEditando] = useState(!factura.confirmacionEn && !factura.esCompraPersonal);
  const [texto, setTexto] = useState(factura.confirmacionTexto ?? "");
  const [por, setPor] = useState(factura.confirmacionPor ?? "Ramón");
  const [socio, setSocio] = useState(factura.socio ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function correr(accion: () => Promise<void>, fallback: string) {
    setSaving(true);
    setError(null);
    try {
      await accion();
    } catch (reason) {
      setError(mensajeDe(reason, fallback));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {error ? <Aviso>{error}</Aviso> : null}
      <div className="rounded-xl border border-[#E7EBE4] p-3">
        <p className="font-semibold">Respuesta de la tienda</p>
        {factura.confirmacionEn && !editando ? (
          <>
            <p className="mt-1 whitespace-pre-wrap">{factura.confirmacionTexto}</p>
            <p className="mt-1 text-xs text-brand-muted">
              {factura.confirmacionPor} · {fechaHora(factura.confirmacionEn)}
            </p>
            <button type="button" className="mt-2 text-xs font-bold" style={{ color: brand.blue }} onClick={() => setEditando(true)}>
              Corregir
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-brand-muted">Sin esta respuesta Phillip no puede dejarla registrada, salvo que sea compra personal.</p>
            <AdminTextarea value={texto} onChange={(event) => setTexto(event.target.value)} rows={3} className="mt-2" placeholder="Lo que contestó la tienda sobre las cantidades" aria-label="Respuesta de la tienda" />
            <AdminInput value={por} onChange={(event) => setPor(event.target.value)} className="mt-2" aria-label="Quién respondió" />
            <div className="mt-2 flex flex-wrap gap-2">
              <BotonPrincipal
                disabled={saving || !texto.trim()}
                onClick={() =>
                  void correr(async () => {
                    await enviar("/confirmacion", "POST", { texto, confirmadoPor: por });
                    setEditando(false);
                  }, "No pudimos guardar la respuesta")
                }
              >
                Guardar respuesta
              </BotonPrincipal>
              {factura.confirmacionEn ? <BotonSecundario onClick={() => setEditando(false)}>Cancelar</BotonSecundario> : null}
            </div>
          </>
        )}
      </div>
      <div className="rounded-xl border border-[#E7EBE4] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Compra personal</p>
          {factura.esCompraPersonal ? <Pill label={factura.socio ? `De ${factura.socio}` : "Marcada"} tone={TONO.navy} /> : null}
        </div>
        <p className="mt-1 text-brand-muted">Cuenta para el ITBIS de Boris. No entra como mercancía ni en cuentas por pagar.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[160px] flex-1">
            <AdminInput value={socio} onChange={(event) => setSocio(event.target.value)} placeholder="Socio" aria-label="Socio" />
          </div>
          <BotonSecundario
            disabled={saving}
            onClick={() =>
              void correr(() => enviar("/marca", "POST", { esCompraPersonal: !factura.esCompraPersonal, socio }), "No pudimos guardar la marca")
            }
          >
            {factura.esCompraPersonal ? "Quitar marca" : "Marcar como personal"}
          </BotonSecundario>
        </div>
      </div>
    </div>
  );
}
