"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FACTURA_ESTADOS, formatMonto, type FacturaDetalle, type FacturaEstado } from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";
import { bloqueoRegistro } from "@/components/admin/facturas/falta";
import { mensajeDe, type EnviarFactura } from "@/components/admin/facturas/useFactura";
import { Aviso, BotonPrincipal, ETAPAS_CAMINO, Pill, TONO, estadoCorto, estadoTono, pasoDeEtapa } from "@/components/admin/facturas/ui";

type Navegacion = { anterior: string | null; siguiente: string | null; posicion: number | null; total: number; volver: string };

export function FacturaEncabezado({ factura, enviar, nav }: { factura: FacturaDetalle; enviar: EnviarFactura; nav: Navegacion }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bloqueo = bloqueoRegistro(factura);
  const registrable = bloqueo === null;

  async function borrar() {
    setBorrando(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/facturas/${factura.id}`, { method: "DELETE", credentials: "include" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "No pudimos borrar la factura");
      }
      router.push(nav.volver);
      router.refresh();
    } catch (reason) {
      setError(mensajeDe(reason, "No pudimos borrar la factura"));
      setBorrando(false);
    }
  }

  async function cambiarEtapa(estado: FacturaEstado) {
    setSaving(true);
    setError(null);
    try {
      await enviar("", "PATCH", { estado });
    } catch (reason) {
      setError(mensajeDe(reason, "No pudimos cambiar la etapa"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="rounded-2xl border border-[#E7EBE4] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={nav.volver} className="font-semibold text-brand-muted hover:text-brand-ink">
          ← Facturas
        </Link>
        <div className="flex items-center gap-1">
          {nav.posicion != null ? (
            <span className="mr-2 text-xs tabular-nums text-brand-muted">
              {nav.posicion} de {nav.total}
            </span>
          ) : null}
          <NavLink href={nav.anterior ? `/admin/facturas/${nav.anterior}` : null} label="Anterior" tecla="K" />
          <NavLink href={nav.siguiente ? `/admin/facturas/${nav.siguiente}` : null} label="Siguiente" tecla="J" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight">{factura.proveedor || "Sin proveedor"}</h1>
          <p className="mt-1 text-sm text-brand-muted">
            {[factura.tienda, factura.ncf, factura.numeroFactura, factura.tipoDocumentoLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold tabular-nums">{formatMonto(factura.total, factura.moneda)}</p>
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            {factura.problema ? <Pill label="Con problema" tone={TONO.rojo} /> : null}
            {factura.esCompraPersonal ? <Pill label={factura.socio ? `Personal · ${factura.socio}` : "Compra personal"} tone={TONO.navy} /> : null}
          </div>
        </div>
      </div>

      <Etapas estado={factura.estado} />

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl px-3 py-3" style={{ backgroundColor: "#F7F8F6" }}>
        <SiguientePaso factura={factura} bloqueo={bloqueo} saving={saving} onRegistrar={() => void cambiarEtapa("registrada")} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirmarBorrado ? (
          <>
            <p className="text-sm text-brand-muted">
              Se borra esta factura, su foto y, si era la única y no está pagada, la cuenta por pagar. No se puede deshacer.
            </p>
            <button
              type="button"
              disabled={borrando}
              onClick={() => setConfirmarBorrado(false)}
              className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={borrando}
              onClick={() => void borrar()}
              className="rounded-full px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: brand.error }}
            >
              {borrando ? "Borrando…" : "Borrar factura"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirmarBorrado(true);
            }}
            className="rounded-full border px-3 py-1.5 text-sm font-semibold"
            style={{ borderColor: "#FECACA", color: brand.error }}
          >
            Borrar factura
          </button>
        )}
      </div>

      {error ? (
        <div className="mt-3">
          <Aviso>{error}</Aviso>
        </div>
      ) : null}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-brand-muted">Cambiar etapa a mano</summary>
        <p className="mt-2 text-brand-muted">
          A mano no abre la cuenta por pagar ni la marca pagada. Lo normal es que Boris y Fred publiquen su revisión.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FACTURA_ESTADOS.filter((item) => item.id !== factura.estado).map((item) => {
            const bloqueada = item.id === "registrada" && !registrable;
            return (
              <button
                key={item.id}
                type="button"
                disabled={saving || bloqueada}
                onClick={() => void cambiarEtapa(item.id)}
                title={bloqueada ? bloqueo ?? item.ayuda : item.ayuda}
                className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 font-semibold disabled:opacity-50"
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </details>
    </header>
  );
}

function NavLink({ href, label, tecla }: { href: string | null; label: string; tecla: string }) {
  const clase = "rounded-full border border-[#E5E7EB] px-3 py-1.5 text-xs font-bold";
  if (!href) {
    return (
      <span className={`${clase} text-brand-muted opacity-50`} aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={`${clase} bg-white hover:bg-[#F7F8F6]`} title={`${label} (${tecla})`}>
      {label}
    </Link>
  );
}

function Etapas({ estado }: { estado: FacturaEstado }) {
  const paso = pasoDeEtapa(estado);
  if (estado === "falta_factura") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <Pill label={estadoCorto(estado)} tone={estadoTono(estado)} />
        <span className="text-brand-muted">{FACTURA_ESTADOS.find((item) => item.id === estado)?.ayuda}</span>
      </div>
    );
  }
  return (
    <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Etapas">
      {ETAPAS_CAMINO.map((item, index) => {
        const hecho = index <= paso;
        const actual = index === paso;
        return (
          <li key={item.id} aria-current={actual ? "step" : undefined}>
            <span className="block h-1.5 rounded-full" style={{ backgroundColor: hecho ? brand.green : "#E5E7EB" }} />
            <span className={`mt-1.5 block text-xs ${actual ? "font-bold text-brand-ink" : "font-semibold text-brand-muted"}`}>{item.label}</span>
            <span className="block text-[11px] text-brand-muted">{item.quien}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SiguientePaso({
  factura,
  bloqueo,
  saving,
  onRegistrar,
}: {
  factura: FacturaDetalle;
  bloqueo: string | null;
  saving: boolean;
  onRegistrar: () => void;
}) {
  const registrable = bloqueo === null;
  if (factura.estado === "falta_factura") {
    return <Texto titulo="Siguiente paso" texto="Falta el comprobante. Cuando llegue la foto, Rodrigo la sube y pasa a recibida." />;
  }
  if (factura.estado === "recibida") {
    return (
      <>
        <Texto
          titulo="Siguiente paso"
          texto={registrable ? "Phillip la deja registrada cuando termina los renglones." : `${bloqueo}.`}
        />
        <div className="ml-auto flex items-center gap-2">
          {!registrable && factura.lineas.length ? (
            <a href="#productos" className="text-sm font-bold" style={{ color: brand.blue }}>
              Confirmar recepción
            </a>
          ) : null}
          <BotonPrincipal disabled={saving || !registrable} onClick={onRegistrar}>
            Marcar registrada
          </BotonPrincipal>
        </div>
      </>
    );
  }
  if (factura.estado === "registrada") {
    return <Texto titulo="Siguiente paso" texto="Le toca a Boris verificar RNC, NCF y montos. Si cuadra, abre la cuenta por pagar." />;
  }
  if (factura.estado === "verificada") {
    return <Texto titulo="Siguiente paso" texto="Le toca a Fred encontrar el pago en banco, caja o CardNET." />;
  }
  return <Texto titulo="Lista" texto="Fred la concilió. No queda nada en el camino de esta factura." />;
}

function Texto({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">{titulo}</p>
      <p className="mt-0.5 text-sm font-semibold">{texto}</p>
    </div>
  );
}
