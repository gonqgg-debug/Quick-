"use client";

import { useState, type ReactNode } from "react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminField";
import { formatMonto, resumenRecepcion, type FacturaDetalle } from "@/lib/facturas-shared";
import { bloqueoRegistro } from "@/components/admin/facturas/falta";
import { brand } from "@/lib/theme";
import { mensajeDe, type EnviarFactura } from "@/components/admin/facturas/useFactura";
import { Aviso, BotonPrincipal, BotonSecundario, Pill, Seccion, TONO, fechaCorta, fechaHora, pasoDeEtapa } from "@/components/admin/facturas/ui";

type Estado = "hecho" | "pendiente" | "problema";

export function Equipo({ factura, enviar }: { factura: FacturaDetalle; enviar: EnviarFactura }) {
  const paso = pasoDeEtapa(factura.estado);
  const recepcion = resumenRecepcion(factura.lineas);
  const rodrigo: Estado = factura.esCompraPersonal || (recepcion.lineas > 0 && recepcion.sinConfirmar === 0) ? (recepcion.faltantes ? "problema" : "hecho") : "pendiente";
  const bloqueo = bloqueoRegistro(factura);
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
        <Paso nombre="Rodrigo" rol="Recepción, respuesta de la tienda y compra personal" estado={rodrigo}>
          <Rodrigo factura={factura} enviar={enviar} />
        </Paso>
        <Paso nombre="Phillip" rol="Registra los renglones" estado={phillip}>
          <p className="text-sm text-brand-muted">
            {phillip === "hecho"
              ? `Renglones listos: ${factura.numeroProductos} producto${factura.numeroProductos === 1 ? "" : "s"}.`
              : bloqueo === null
                ? "Puede dejarla registrada cuando termine los renglones."
                : `${bloqueo}.`}
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
          <Fred factura={factura} enviar={enviar} />
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

  const recepcion = resumenRecepcion(factura.lineas);
  const confirmadas = recepcion.lineas - recepcion.sinConfirmar;

  return (
    <div className="space-y-3 text-sm">
      {error ? <Aviso>{error}</Aviso> : null}
      <div className="rounded-xl border border-[#E7EBE4] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Recepción</p>
          {recepcion.lineas ? (
            <span className="text-xs text-brand-muted">
              {confirmadas} de {recepcion.lineas} líneas confirmadas
            </span>
          ) : null}
        </div>
        {!recepcion.lineas ? (
          <p className="mt-1 text-brand-muted">Se confirma cuando Phillip extraiga los productos.</p>
        ) : (
          <>
            <p className="mt-1 text-brand-muted">
              {recepcion.sinConfirmar
                ? "Marca cada línea en Productos como completa, faltante o regalo. Phillip no puede registrarla hasta que todas estén confirmadas."
                : "Todas las líneas están confirmadas."}
              {recepcion.faltantes ? ` ${recepcion.faltantes === 1 ? "Una llegó incompleta" : `${recepcion.faltantes} llegaron incompletas`}: faltan ${formatMonto(recepcion.diferencia, factura.moneda)}.` : ""}
              {recepcion.regalos ? ` ${recepcion.regalos === 1 ? "Una vino de regalo" : `${recepcion.regalos} vinieron de regalo`}.` : ""}
            </p>
            {recepcion.sinConfirmar ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <BotonPrincipal
                  disabled={saving}
                  onClick={() => void correr(() => enviar("/recepcion", "POST", { todas: "completa" }), "No pudimos guardar la recepción")}
                >
                  Llegó todo completo
                </BotonPrincipal>
                <a href="#productos" className="self-center text-xs font-bold" style={{ color: brand.blue }}>
                  Marcar por línea
                </a>
              </div>
            ) : null}
          </>
        )}
      </div>
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
            <p className="mt-1 text-brand-muted">Queda en la ficha como evidencia de lo que contestó la tienda.</p>
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

function Fred({ factura, enviar }: { factura: FacturaDetalle; enviar: EnviarFactura }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const abierta = factura.estado !== "conciliada";

  async function correr(clave: string, accion: () => Promise<void>, fallback: string) {
    setSaving(clave);
    setError(null);
    try {
      await accion();
    } catch (reason) {
      setError(mensajeDe(reason, fallback));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {error ? <Aviso>{error}</Aviso> : null}
      {factura.conciliacion ? (
        <p>
          <span className="font-semibold">
            {factura.conciliacion.resultadoLabel}
            {factura.conciliacion.medioLabel ? ` por ${factura.conciliacion.medioLabel}` : ""}
            {factura.conciliacion.fecha ? ` el ${fechaCorta(factura.conciliacion.fecha)}` : ""}
          </span>
          {factura.conciliacion.nota ? <span className="mt-1 block text-brand-muted">{factura.conciliacion.nota}</span> : null}
        </p>
      ) : (
        <p className="text-brand-muted">Todavía no publica la conciliación.</p>
      )}
      {factura.pagos.length ? (
        <div className="rounded-xl border border-[#E7EBE4] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Pagos ligados</p>
            {factura.pagosDiferencia != null ? (
              factura.pagosDiferencia === 0 ? (
                <Pill label="Cuadra con el total" tone={TONO.verde} />
              ) : (
                <Pill
                  label={factura.pagosDiferencia > 0 ? `Faltan ${formatMonto(factura.pagosDiferencia, factura.moneda)}` : `Sobran ${formatMonto(-factura.pagosDiferencia, factura.moneda)}`}
                  tone={TONO.naranja}
                />
              )
            ) : null}
          </div>
          <ul className="mt-2 divide-y divide-[#F0F2EE]">
            {factura.pagos.map((pago) => (
              <li key={pago.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-semibold tabular-nums">{formatMonto(pago.monto, "DOP")}</p>
                  <p className="text-xs text-brand-muted">
                    {[pago.origen === "banco" ? "Banco" : "Caja", fechaCorta(pago.fecha), pago.caja, pago.concepto].filter(Boolean).join(" · ")} · ligado por {pago.confirmadoPor}
                    {pago.confianza != null ? ` · ${pago.confianza}% seguro` : ""}
                  </p>
                  {pago.razon ? <p className="text-xs leading-relaxed text-brand-muted">{pago.razon}</p> : null}
                </div>
                {abierta ? (
                  <button
                    type="button"
                    disabled={saving !== null}
                    className="text-xs font-bold disabled:opacity-40"
                    style={{ color: brand.error }}
                    onClick={() => void correr(pago.id, () => enviar(`/pagos/${pago.id}`, "DELETE"), "No pudimos quitar el pago")}
                  >
                    {saving === pago.id ? "..." : "Quitar"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {abierta && factura.pagosCandidatos.length ? (
        <div className="rounded-xl border border-[#E7EBE4] p-3">
          <p className="font-semibold">Posibles pagos</p>
          <p className="mt-1 text-brand-muted">
            Salidas de caja del día de la factura (un día antes o después) y débitos del banco hasta una semana después del vencimiento, por el mismo monto. Nada se liga solo: confírmalo tú o Fred.
          </p>
          <ul className="mt-2 divide-y divide-[#F0F2EE]">
            {factura.pagosCandidatos.map((candidato) => {
              const clave = candidato.ledgerId ?? candidato.movimientoId ?? "";
              return (
                <li key={clave} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-semibold tabular-nums">
                      {formatMonto(candidato.monto, "DOP")} <span className="text-xs font-medium text-brand-muted">· coincide {candidato.confianza}%</span>
                    </p>
                    <p className="text-xs text-brand-muted">
                      {[candidato.origen === "banco" ? "Banco" : "Caja", fechaCorta(candidato.fecha), candidato.caja, candidato.concepto, candidato.referencia].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <BotonSecundario
                    disabled={saving !== null}
                    onClick={() =>
                      void correr(
                        clave,
                        () => enviar("/pagos", "POST", candidato.origen === "banco" ? { movimientoId: candidato.movimientoId } : { ledgerId: candidato.ledgerId }),
                        "No pudimos ligar el pago"
                      )
                    }
                  >
                    {saving === clave ? "..." : "Ligar"}
                  </BotonSecundario>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
