import Link from "next/link";
import { notFound } from "next/navigation";
import { MilesDetalleAcciones } from "@/components/admin/consumo/MilesDetalleAcciones";
import { hrefEvidencia, type EvidenciaMiles } from "@/lib/miles-domain";
import { leerHallazgo } from "@/lib/miles-store";
import { formatRd } from "@/lib/pos-domain";

export const dynamic = "force-dynamic";

export default async function MilesHallazgoPage({ params }: { params: { id: string } }) {
  let detalle: Awaited<ReturnType<typeof leerHallazgo>> = null;
  try {
    detalle = await leerHallazgo(params.id);
  } catch {
    detalle = null;
  }
  if (!detalle) notFound();
  const row = detalle.hallazgo;
  const evidencia = row.evidencia as EvidenciaMiles;
  const metricas = row.metricas as Record<string, unknown>;
  return (
    <article className="space-y-5">
      <Link href="/admin/consumo/miles" className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>Volver a Miles</Link>
      <header>
        <h2 className="text-xl font-semibold">{String(row.titulo)}</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {String(row.periodo_desde)} a {String(row.periodo_hasta)} · {String(row.tienda)} · publicado {String(row.publicado_en)}
        </p>
      </header>
      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5">
        <h3 className="text-sm font-semibold">Observación</h3>
        <p className="mt-2 text-sm">{String(row.observacion)}</p>
        {row.interpretacion ? <p className="mt-3 text-sm text-brand-muted">Interpretación, separada de la observación: {String(row.interpretacion)}</p> : null}
        {row.recomendacion ? <p className="mt-3 text-sm">Recomendación: {String(row.recomendacion)}</p> : null}
        {row.limitaciones ? <p className="mt-3 text-sm">Limitaciones: {String(row.limitaciones)}</p> : null}
        <p className="mt-3 text-xs text-brand-muted">Prioridad {String(row.prioridad)}: {String(row.prioridad_justificacion)}</p>
      </section>
      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5">
        <h3 className="text-sm font-semibold">Snapshot publicado</h3>
        <p className="mt-1 text-xs text-brand-muted">Estos números quedaron guardados al publicar. No se recalculan si cambias el filtro del dashboard ni si entra una importación nueva.</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(metricas).slice(0, 12).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-brand-muted">{key}</dt>
              <dd className="text-sm font-semibold">{typeof value === "number" ? formatRd(value) : String(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-brand-muted">Consultas: {evidencia.consultas?.join(", ")} · corte {row.corte ? String(row.corte) : "no indicado"}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {(evidencia.enlaces ?? []).map((enlace) => (
            <Link key={`${enlace.pantalla}${enlace.query}`} href={hrefEvidencia(enlace.pantalla, enlace.query)} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
              Consulta actual en {enlace.pantalla}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-brand-muted">La consulta actual usa los mismos filtros, pero los datos de hoy pueden diferir del snapshot.</p>
      </section>
      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5">
        <h3 className="text-sm font-semibold">Historial</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {detalle.eventos.map((evento) => (
            <li key={String(evento.id)}>{String(evento.en).slice(0, 16).replace("T", " ")} · {String(evento.actor)} · {String(evento.accion)}</li>
          ))}
        </ul>
      </section>
      <MilesDetalleAcciones id={String(row.id)} version={Number(row.version)} estado={String(row.estado)} />
    </article>
  );
}
