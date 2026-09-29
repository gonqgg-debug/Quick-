"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminInput, AdminSelect, AdminTextarea, adminLabelClass } from "@/components/admin/AdminField";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";
import { AdminExpansionMap } from "@/components/admin/AdminExpansionMap";
import {
  EXPANSION_ETAPAS,
  EXPANSION_FUENTES,
  EXPANSION_TIPOS_ACTIVIDAD,
  EXPANSION_TIPOS_CONTACTO,
  EXPANSION_TRATOS,
  type ExpansionActividad,
  type ExpansionContacto,
  type ExpansionEtapa,
  type ExpansionMeta,
  type ExpansionPipeline,
  type ExpansionSitio,
  type ExpansionTipoActividad,
  type ExpansionTipoContacto,
  type ExpansionTrato,
} from "@/lib/expansion-shared";
import { brand } from "@/lib/theme";

type Board = {
  pipeline: ExpansionPipeline;
  sitios: ExpansionSitio[];
  contactos: ExpansionContacto[];
};

type Tab = "tablero" | "lista" | "mapa" | "personas";
type EtapaFilter = "todas" | ExpansionEtapa;

function fechaCorta(value: string | null): string {
  if (!value) {
    return "—";
  }
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function metaEstado(meta: ExpansionMeta): string {
  if (meta.meta <= 0 || meta.diferencia == null) {
    return "Sin meta";
  }
  if (meta.diferencia === 0) {
    return "En la meta";
  }
  if (meta.diferencia > 0) {
    return `${meta.diferencia} por encima`;
  }
  return `Faltan ${Math.abs(meta.diferencia)}`;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || fallback;
}

export function AdminExpansion() {
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("tablero");
  const [etapa, setEtapa] = useState<EtapaFilter>("todas");
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [q, setQ] = useState("");
  const [contactoQ, setContactoQ] = useState("");
  const [editingContacto, setEditingContacto] = useState<ExpansionContacto | "new" | null>(null);
  const [editingSitio, setEditingSitio] = useState<ExpansionSitio | "new" | null>(null);
  const [editingMetas, setEditingMetas] = useState(false);
  const [openSitioId, setOpenSitioId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/expansion", { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!response.ok) {
      throw new Error(await readError(response, "No pudimos cargar el pipeline"));
    }
    setBoard((await response.json()) as Board);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
        if (!cancelled) {
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const sitios = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (board?.sitios ?? [])
      .filter((sitio) => {
        if (etapa !== "todas" && sitio.etapa !== etapa) {
          return false;
        }
        if (soloVencidos && !sitio.seguimientoVencido) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return [sitio.nombre, sitio.zona, sitio.direccion, sitio.desarrollador, sitio.clave, sitio.contacto?.nombre, sitio.proximaAccion].some((value) =>
          value?.toLowerCase().includes(needle)
        );
      })
      .sort((left, right) => {
        if (left.seguimientoVencido !== right.seguimientoVencido) {
          return left.seguimientoVencido ? -1 : 1;
        }
        return (left.proximaFecha ?? "9999-99-99").localeCompare(right.proximaFecha ?? "9999-99-99");
      });
  }, [board?.sitios, etapa, q, soloVencidos]);

  const contactos = useMemo(() => {
    const needle = contactoQ.trim().toLowerCase();
    return (board?.contactos ?? []).filter((contacto) => {
      if (!needle) {
        return true;
      }
      return [contacto.nombre, contacto.empresa, contacto.telefono, contacto.whatsapp, contacto.email, contacto.cargo, contacto.clave, contacto.tipoLabel].some(
        (value) => value?.toLowerCase().includes(needle)
      );
    });
  }, [board?.contactos, contactoQ]);

  async function refresh(message?: string) {
    await load();
    setNotice(message ?? null);
    setError(null);
  }

  const pipeline = board?.pipeline;

  const sinMapa = (board?.sitios ?? []).filter((sitio) => !sitio.enMapa);

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">Expansión</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-brand-muted">
            {pipeline ? `${pipeline.activos} en curso` : "Oportunidades, personas y el próximo paso"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={() => setEditingMetas(true)}>Metas</GhostButton>
          <GhostButton onClick={() => setEditingContacto("new")}>Persona</GhostButton>
          <Button type="button" size="sm" onClick={() => setEditingSitio("new")}>
            Oportunidad
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: brand.paleGreen, color: brand.ink }}>
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />
      ) : pipeline ? (
        <>
          <div className="mt-5 grid grid-cols-2 divide-x divide-y divide-[#E7EBE4] overflow-hidden rounded-2xl border border-[#E7EBE4] bg-white md:grid-cols-4 md:divide-y-0">
            {pipeline.metas.map((meta) => (
              <div key={meta.id} className="px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{meta.etiqueta}</p>
                <p className="font-display mt-1 text-2xl font-bold tabular-nums">{meta.actual}</p>
                <p className="text-xs text-brand-muted">{meta.meta > 0 ? `Meta ${meta.meta} · ${metaEstado(meta)}` : metaEstado(meta)}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setSoloVencidos((current) => !current);
                setEtapa("todas");
                setTab("tablero");
              }}
              className="px-4 py-3 text-left"
              style={{ backgroundColor: soloVencidos || pipeline.seguimientosVencidos > 0 ? brand.paleOrange : "#fff" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Atrasados</p>
              <p className="font-display mt-1 text-2xl font-bold tabular-nums" style={{ color: pipeline.seguimientosVencidos > 0 ? "#9A3412" : brand.ink }}>
                {pipeline.seguimientosVencidos}
              </p>
              <p className="text-xs text-brand-muted">{soloVencidos ? "Filtro activo" : "El trabajo de hoy"}</p>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full bg-[#EEF2EA] p-1" role="tablist" aria-label="Vista del pipeline">
              {(
                [
                  ["tablero", "Tablero"],
                  ["lista", "Lista"],
                  ["mapa", "Mapa"],
                  ["personas", "Personas"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className="rounded-full px-3 text-sm font-semibold"
                  style={{
                    minHeight: 34,
                    backgroundColor: tab === id ? "#fff" : "transparent",
                    color: brand.ink,
                    boxShadow: tab === id ? "0 1px 2px rgba(26,26,26,0.08)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab !== "personas" ? (
              <div className="w-full max-w-sm">
                <AdminInput
                  bare
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Buscar oportunidad, zona o persona"
                  aria-label="Buscar oportunidades"
                />
              </div>
            ) : null}
          </div>

          {tab !== "personas" && tab !== "mapa" ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <FilterChip active={etapa === "todas" && !soloVencidos} onClick={() => { setEtapa("todas"); setSoloVencidos(false); }}>
                Todas
              </FilterChip>
              {pipeline.etapas.map((item) => (
                <FilterChip
                  key={item.id}
                  active={etapa === item.id}
                  onClick={() => {
                    setEtapa(item.id);
                    setSoloVencidos(false);
                  }}
                >
                  {item.label}
                  <span className="ml-1 tabular-nums opacity-70">{item.sitios}</span>
                </FilterChip>
              ))}
            </div>
          ) : null}

          {tab === "tablero" ? (
            sitios.length === 0 ? (
              <Empty
                title={board?.sitios.length ? "Nada en este filtro" : "El pipeline está vacío"}
                body={board?.sitios.length ? "Quita el filtro para ver el resto de las etapas." : "Crea la primera oportunidad, o deja que el bot la suba."}
              />
            ) : (
              <PipelineBoard sitios={sitios} etapas={pipeline.etapas} etapa={etapa} soloVencidos={soloVencidos} onOpen={setOpenSitioId} />
            )
          ) : null}

          {tab === "lista" ? (
            <section className="mt-4">
              {sitios.length === 0 ? (
                <Empty
                  title={board?.sitios.length ? "Ninguna oportunidad con ese filtro" : "Todavía no hay oportunidades"}
                  body={board?.sitios.length ? "Prueba otra etapa o limpia la búsqueda." : "Crea la primera, o deja que el bot la suba."}
                />
              ) : (
                <DataTable tableClassName="min-w-[860px]">
                  <DataTableHead>
                    <DataTableTh>Oportunidad</DataTableTh>
                    <DataTableTh>Etapa</DataTableTh>
                    <DataTableTh>Persona</DataTableTh>
                    <DataTableTh>Próximo paso</DataTableTh>
                    <DataTableTh>Fecha</DataTableTh>
                  </DataTableHead>
                  <tbody>
                    {sitios.map((sitio) => (
                      <DataTableRow key={sitio.id} onClick={() => setOpenSitioId(sitio.id)}>
                        <DataTableCell>
                          <p className="font-semibold">{sitio.nombre}</p>
                          <p className="mt-0.5 text-xs text-brand-muted">{[sitio.zona, sitio.tratoLabel].filter(Boolean).join(" · ") || "Sin zona"}</p>
                        </DataTableCell>
                        <DataTableCell>
                          <EtapaPill etapa={sitio.etapa} label={sitio.etapaLabel} />
                        </DataTableCell>
                        <DataTableCell>{sitio.contacto?.nombre || "—"}</DataTableCell>
                        <DataTableCell className="max-w-[240px]">
                          <span className="line-clamp-2">{sitio.proximaAccion || "Sin definir"}</span>
                        </DataTableCell>
                        <DataTableCell className="whitespace-nowrap">
                          <span className="tabular-nums" style={{ color: sitio.seguimientoVencido ? "#9A3412" : undefined, fontWeight: sitio.seguimientoVencido ? 700 : 500 }}>
                            {sitio.seguimientoVencido ? "Atrasado · " : ""}
                            {fechaCorta(sitio.proximaFecha)}
                          </span>
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </section>
          ) : null}

          {tab === "mapa" ? (
            <section className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_320px]">
              <AdminExpansionMap sitios={sitios.length ? sitios : board?.sitios ?? []} onSelect={setOpenSitioId} />
              <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                  {(board?.sitios ?? []).filter((sitio) => sitio.enMapa).length} en el mapa
                  {sinMapa.length ? ` · ${sinMapa.length} sin ubicación` : ""}
                </p>
                {(q ? sitios : board?.sitios ?? []).map((sitio) => (
                  <button
                    key={sitio.id}
                    type="button"
                    onClick={() => setOpenSitioId(sitio.id)}
                    className="flex w-full items-start gap-3 rounded-2xl bg-white px-3 py-3 text-left"
                    style={{ border: "1px solid #E7EBE4" }}
                  >
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sitio.enMapa ? etapaColor(sitio.etapa) : "#D1D5DB" }} />
                    <span>
                      <span className="block text-sm font-semibold">{sitio.nombre}</span>
                      <span className="mt-0.5 block text-xs text-brand-muted">
                        {sitio.zona || "Sin zona"} · {sitio.enMapa ? sitio.etapaLabel : "falta ubicación"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "personas" ? (
            <section className="mt-4">
              <div className="max-w-sm">
                <AdminInput
                  bare
                  value={contactoQ}
                  onChange={(event) => setContactoQ(event.target.value)}
                  placeholder="Buscar persona, empresa o teléfono"
                  aria-label="Buscar personas"
                />
              </div>
              {contactos.length === 0 ? (
                <Empty
                  title={board?.contactos.length ? "Nadie con esa búsqueda" : "Todavía no hay personas"}
                  body="Brokers, desarrolladores y propietarios. El bot puede subirlos con teléfono, WhatsApp y cargo."
                />
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {contactos.map((contacto) => (
                    <article key={contacto.id} className="rounded-2xl bg-white p-4" style={{ border: "1px solid #E7EBE4" }}>
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: brand.navy }}
                        >
                          {iniciales(contacto.nombre)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{contacto.nombre}</p>
                          <p className="truncate text-sm text-brand-muted">{contacto.cargo || contacto.empresa || contacto.tipoLabel}</p>
                        </div>
                        <button type="button" onClick={() => setEditingContacto(contacto)} className="text-sm font-bold" style={{ color: brand.green }}>
                          Editar
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: brand.paleBlue, color: brand.navy }}>
                          {contacto.tipoLabel}
                        </span>
                        {contacto.fuenteLabel ? <span className="text-xs text-brand-muted">{contacto.fuenteLabel}</span> : null}
                      </div>
                      <div className="mt-3 space-y-1 text-sm">
                        {contacto.telefono ? <a href={`tel:${contacto.telefono}`} className="block font-medium" style={{ color: brand.navy }}>{contacto.telefono}</a> : null}
                        {contacto.whatsapp ? <p className="text-brand-muted">WhatsApp {contacto.whatsapp}</p> : null}
                        {contacto.email ? <a href={`mailto:${contacto.email}`} className="block truncate" style={{ color: brand.navy }}>{contacto.email}</a> : null}
                        {!contacto.telefono && !contacto.email ? <p className="text-brand-muted">Sin teléfono ni correo</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {editingContacto ? (
        <ContactoModal
          contacto={editingContacto === "new" ? null : editingContacto}
          onClose={() => setEditingContacto(null)}
          onSaved={async (reused) => {
            setEditingContacto(null);
            await refresh(reused ? "Esa clave ya existía, así que no se duplicó el contacto." : undefined);
          }}
        />
      ) : null}
      {editingSitio ? (
        <SitioModal
          sitio={editingSitio === "new" ? null : editingSitio}
          contactos={board?.contactos ?? []}
          onClose={() => setEditingSitio(null)}
          onSaved={async (reused) => {
            setEditingSitio(null);
            await refresh(reused ? "Esa clave ya existía, así que no se duplicó el sitio." : undefined);
          }}
        />
      ) : null}
      {editingMetas && pipeline ? (
        <MetasModal
          metas={pipeline.metas}
          onClose={() => setEditingMetas(false)}
          onSaved={async () => {
            setEditingMetas(false);
            await refresh("Metas guardadas.");
          }}
        />
      ) : null}
      {openSitioId ? (
        <SitioDetalle
          sitioId={openSitioId}
          contactos={board?.contactos ?? []}
          onClose={() => setOpenSitioId(null)}
          onEdit={(sitio) => {
            setOpenSitioId(null);
            setEditingSitio(sitio);
          }}
          onChanged={async () => {
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 text-sm font-semibold"
      style={{ minHeight: 40, border: "1px solid #E5E7EB", backgroundColor: "#fff", color: brand.ink }}
    >
      {children}
    </button>
  );
}

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function etapaColor(etapa: ExpansionEtapa): string {
  if (etapa === "descartado" || etapa === "pausa") return "#9CA3AF";
  if (etapa === "oportunidad" || etapa === "negociacion") return brand.orange;
  if (etapa === "conversacion" || etapa === "respondio" || etapa === "presentacion_enviada") return brand.green;
  return brand.blue;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-3 text-sm font-semibold"
      style={{
        minHeight: 32,
        backgroundColor: active ? brand.ink : "#fff",
        color: active ? "#fff" : brand.ink,
        border: active ? `1px solid ${brand.ink}` : "1px solid #E5E7EB",
      }}
    >
      {children}
    </button>
  );
}

const BOARD_TAIL = new Set<ExpansionEtapa>(["pausa", "descartado"]);

function PipelineBoard({
  sitios,
  etapas,
  etapa,
  soloVencidos,
  onOpen,
}: {
  sitios: ExpansionSitio[];
  etapas: ExpansionPipeline["etapas"];
  etapa: EtapaFilter;
  soloVencidos: boolean;
  onOpen: (id: string) => void;
}) {
  const columns = etapas.filter((item) => {
    const cards = sitios.filter((sitio) => sitio.etapa === item.id);
    if (etapa !== "todas") return item.id === etapa;
    if (soloVencidos) return cards.length > 0;
    if (BOARD_TAIL.has(item.id)) return cards.length > 0;
    return true;
  });

  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
      {columns.map((column) => {
        const cards = sitios.filter((sitio) => sitio.etapa === column.id);
        return (
          <section key={column.id} className="flex w-[272px] shrink-0 flex-col rounded-2xl bg-[#F3F6F1]">
            <header className="flex items-center justify-between px-3 pb-2 pt-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: etapaColor(column.id) }} />
                <span className="truncate">{column.label}</span>
              </span>
              <span className="text-xs font-semibold tabular-nums text-brand-muted">{cards.length}</span>
            </header>
            <div className="flex min-h-[140px] flex-col gap-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "62vh" }}>
              {cards.map((sitio) => (
                <button
                  key={sitio.id}
                  type="button"
                  onClick={() => onOpen(sitio.id)}
                  className="rounded-xl bg-white px-3 py-3 text-left shadow-[0_1px_2px_rgba(26,26,26,0.06)]"
                  style={{ boxShadow: sitio.seguimientoVencido ? `inset 3px 0 0 ${brand.orange}` : undefined }}
                >
                  <p className="font-semibold leading-snug">{sitio.nombre}</p>
                  <p className="mt-1 truncate text-xs text-brand-muted">{[sitio.zona, sitio.tratoLabel].filter(Boolean).join(" · ") || "Sin zona"}</p>
                  <p className="mt-2 line-clamp-2 text-sm">{sitio.proximaAccion || "Sin próximo paso"}</p>
                  <p className="mt-2 text-xs font-semibold" style={{ color: sitio.seguimientoVencido ? "#9A3412" : brand.muted }}>
                    {sitio.seguimientoVencido ? "Atrasado · " : ""}
                    {sitio.proximaFecha ? fechaCorta(sitio.proximaFecha) : "Sin fecha"}
                    {sitio.contacto ? ` · ${sitio.contacto.nombre}` : ""}
                  </p>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StageRail({ etapa }: { etapa: ExpansionEtapa }) {
  const flow = EXPANSION_ETAPAS.filter((item) => item.id !== "pausa" && item.id !== "descartado");
  const index = flow.findIndex((item) => item.id === etapa);
  return (
    <ol className="mt-4 flex gap-1" aria-label="Avance en el pipeline">
      {flow.map((item, position) => (
        <li
          key={item.id}
          title={item.label}
          className="h-1.5 flex-1 rounded-full"
          style={{ backgroundColor: index >= 0 && position <= index ? etapaColor(item.id) : "#E5E7EB" }}
        />
      ))}
    </ol>
  );
}

function EtapaPill({ etapa, label }: { etapa: ExpansionEtapa; label: string }) {
  const tone =
    etapa === "descartado" || etapa === "pausa"
      ? { bg: "#F3F4F6", color: brand.muted }
      : etapa === "oportunidad" || etapa === "negociacion"
        ? { bg: brand.paleOrange, color: "#9A3412" }
        : etapa === "conversacion" || etapa === "respondio" || etapa === "presentacion_enviada"
          ? { bg: brand.paleGreen, color: "#3F6212" }
          : { bg: brand.paleBlue, color: brand.navy };
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: tone.bg, color: tone.color }}>
      {label}
    </span>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-lg px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="mt-2 text-sm text-brand-muted">{body}</p>
    </div>
  );
}

function ModalFrame({
  title,
  kicker,
  onClose,
  children,
  layout = "dialog",
}: {
  title: string;
  kicker: string;
  onClose: () => void;
  children: ReactNode;
  layout?: "dialog" | "drawer";
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const panelClass =
    layout === "drawer"
      ? "relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white p-6 sm:p-8"
      : "relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6";

  return (
    <div className={layout === "drawer" ? "fixed inset-0 z-[1200] flex justify-end" : "fixed inset-0 z-[1200] flex items-end justify-center px-4 py-6 sm:items-center"}>
      <button type="button" className="absolute inset-0 bg-black/35" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expansion-modal-title"
        className={panelClass}
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{kicker}</p>
        <h2 id="expansion-modal-title" className="font-display mt-1 text-2xl font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
      {message}
    </p>
  );
}

function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded-full px-4 text-sm font-bold" style={{ minHeight: 44, border: "1px solid #E5E7EB" }}>
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
        style={{ minHeight: 44, backgroundColor: brand.green }}
      >
        {saving ? "Guardando…" : label}
      </button>
    </div>
  );
}

function ContactoModal({
  contacto,
  onClose,
  onSaved,
}: {
  contacto: ExpansionContacto | null;
  onClose: () => void;
  onSaved: (reused: boolean) => Promise<void>;
}) {
  const [clave, setClave] = useState(contacto?.clave ?? "");
  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [empresa, setEmpresa] = useState(contacto?.empresa ?? "");
  const [telefono, setTelefono] = useState(contacto?.telefono ?? "");
  const [whatsapp, setWhatsapp] = useState(contacto?.whatsapp ?? "");
  const [email, setEmail] = useState(contacto?.email ?? "");
  const [cargo, setCargo] = useState(contacto?.cargo ?? "");
  const [zona, setZona] = useState(contacto?.zona ?? "");
  const [especialidad, setEspecialidad] = useState(contacto?.especialidad ?? "");
  const [web, setWeb] = useState(contacto?.web ?? "");
  const [instagram, setInstagram] = useState(contacto?.instagram ?? "");
  const [linkedin, setLinkedin] = useState(contacto?.linkedin ?? "");
  const [fuente, setFuente] = useState(contacto?.fuente ?? "");
  const [tipo, setTipo] = useState<ExpansionTipoContacto>(contacto?.tipo ?? "broker");
  const [notas, setNotas] = useState(contacto?.notas ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      clave: clave.trim() || null,
      nombre,
      empresa,
      telefono,
      whatsapp,
      email,
      cargo,
      zona,
      especialidad,
      web,
      instagram,
      linkedin,
      fuente: fuente || null,
      tipo,
      notas,
    };
    const response = await fetch(contacto ? `/api/admin/expansion/contactos/${contacto.id}` : "/api/admin/expansion/contactos", {
      method: contacto ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as { error?: string; creado?: boolean } | null;
    if (!response.ok) {
      setFormError(body?.error || "No pudimos guardar el contacto");
      setSaving(false);
      return;
    }
    await onSaved(body?.creado === false);
  }

  return (
    <ModalFrame title={contacto ? "Editar contacto" : "Nuevo contacto"} kicker="Directorio" onClose={onClose}>
      <form onSubmit={save}>
        <label className={`${adminLabelClass} mt-5`}>
          Nombre
          <AdminInput value={nombre} onChange={(event) => setNombre(event.target.value)} required />
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Tipo
          <AdminSelect value={tipo} onChange={(event) => setTipo(event.target.value as ExpansionTipoContacto)}>
            {EXPANSION_TIPOS_CONTACTO.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </AdminSelect>
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Empresa
          <AdminInput value={empresa} onChange={(event) => setEmpresa(event.target.value)} />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Teléfono
            <AdminInput value={telefono} onChange={(event) => setTelefono(event.target.value)} inputMode="tel" />
          </label>
          <label className={adminLabelClass}>
            WhatsApp
            <AdminInput value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} inputMode="tel" />
          </label>
        </div>
        <label className={`${adminLabelClass} mt-4`}>
          Correo
          <AdminInput value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" />
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Cargo
          <AdminInput value={cargo} onChange={(event) => setCargo(event.target.value)} placeholder="Director Comercial" />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Zona
            <AdminInput value={zona} onChange={(event) => setZona(event.target.value)} />
          </label>
          <label className={adminLabelClass}>
            Especialidad
            <AdminInput value={especialidad} onChange={(event) => setEspecialidad(event.target.value)} />
          </label>
        </div>
        <label className={`${adminLabelClass} mt-4`}>
          Fuente
          <AdminSelect value={fuente} onChange={(event) => setFuente(event.target.value)}>
            <option value="">Sin fuente</option>
            {EXPANSION_FUENTES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </AdminSelect>
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Web
          <AdminInput value={web} onChange={(event) => setWeb(event.target.value)} />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Instagram
            <AdminInput value={instagram} onChange={(event) => setInstagram(event.target.value)} />
          </label>
          <label className={adminLabelClass}>
            LinkedIn
            <AdminInput value={linkedin} onChange={(event) => setLinkedin(event.target.value)} />
          </label>
        </div>
        <label className={`${adminLabelClass} mt-4`}>
          Clave para el bot
          <AdminInput value={clave} onChange={(event) => setClave(event.target.value)} placeholder="broker.juan" />
        </label>
        <p className="mt-1 text-xs text-brand-muted">Opcional. Letras, números, punto, guión y guión bajo. Si ya existe, no se duplica.</p>
        <label className={`${adminLabelClass} mt-4`}>
          Notas
          <AdminTextarea value={notas} onChange={(event) => setNotas(event.target.value)} rows={3} />
        </label>
        <FieldError message={formError} />
        <ModalActions onClose={onClose} saving={saving} label="Guardar contacto" />
      </form>
    </ModalFrame>
  );
}

function SitioModal({
  sitio,
  contactos,
  onClose,
  onSaved,
}: {
  sitio: ExpansionSitio | null;
  contactos: ExpansionContacto[];
  onClose: () => void;
  onSaved: (reused: boolean) => Promise<void>;
}) {
  const [clave, setClave] = useState(sitio?.clave ?? "");
  const [nombre, setNombre] = useState(sitio?.nombre ?? "");
  const [zona, setZona] = useState(sitio?.zona ?? "");
  const [direccion, setDireccion] = useState(sitio?.direccion ?? "");
  const [lat, setLat] = useState(sitio?.lat == null ? "" : String(sitio.lat));
  const [lng, setLng] = useState(sitio?.lng == null ? "" : String(sitio.lng));
  const [desarrollador, setDesarrollador] = useState(sitio?.desarrollador ?? "");
  const [unidades, setUnidades] = useState(sitio?.unidades == null ? "" : String(sitio.unidades));
  const [entrega, setEntrega] = useState(sitio?.entrega ?? "");
  const [porQue, setPorQue] = useState(sitio?.porQue ?? "");
  const [web, setWeb] = useState(sitio?.web ?? "");
  const [fuente, setFuente] = useState(sitio?.fuente ?? "");
  const [trato, setTrato] = useState<ExpansionTrato>(sitio?.trato ?? "alquiler");
  const [etapa, setEtapa] = useState<ExpansionEtapa>(sitio?.etapa ?? "identificado");
  const [contactoId, setContactoId] = useState(sitio?.contacto?.id ?? "");
  const [proximaAccion, setProximaAccion] = useState(sitio?.proximaAccion ?? "");
  const [proximaFecha, setProximaFecha] = useState(sitio?.proximaFecha ?? "");
  const [detalle, setDetalle] = useState(sitio?.detalle ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      clave: clave.trim() || null,
      nombre,
      zona,
      direccion,
      lat: lat.trim() === "" ? null : Number(lat),
      lng: lng.trim() === "" ? null : Number(lng),
      desarrollador,
      unidades: unidades.trim() === "" ? null : Number(unidades),
      entrega,
      porQue,
      web,
      fuente: fuente || null,
      trato,
      etapa,
      contactoId: contactoId || null,
      proximaAccion,
      proximaFecha: proximaFecha || null,
      detalle,
    };
    const response = await fetch(sitio ? `/api/admin/expansion/sitios/${sitio.id}` : "/api/admin/expansion/sitios", {
      method: sitio ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as { error?: string; creado?: boolean } | null;
    if (!response.ok) {
      setFormError(body?.error || "No pudimos guardar el sitio");
      setSaving(false);
      return;
    }
    await onSaved(body?.creado === false);
  }

  return (
    <ModalFrame title={sitio ? "Editar sitio" : "Nuevo sitio"} kicker="Pipeline" onClose={onClose}>
      <form onSubmit={save}>
        <label className={`${adminLabelClass} mt-5`}>
          Nombre del sitio
          <AdminInput value={nombre} onChange={(event) => setNombre(event.target.value)} required />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Zona
            <AdminInput value={zona} onChange={(event) => setZona(event.target.value)} />
          </label>
          <label className={adminLabelClass}>
            Trato
            <AdminSelect value={trato} onChange={(event) => setTrato(event.target.value as ExpansionTrato)}>
              {EXPANSION_TRATOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </AdminSelect>
          </label>
        </div>
        <label className={`${adminLabelClass} mt-4`}>
          Etapa
          <AdminSelect value={etapa} onChange={(event) => setEtapa(event.target.value as ExpansionEtapa)}>
            {EXPANSION_ETAPAS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </AdminSelect>
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Dirección
          <AdminInput value={direccion} onChange={(event) => setDireccion(event.target.value)} />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Latitud
            <AdminInput value={lat} onChange={(event) => setLat(event.target.value)} inputMode="decimal" placeholder="18.62" />
          </label>
          <label className={adminLabelClass}>
            Longitud
            <AdminInput value={lng} onChange={(event) => setLng(event.target.value)} inputMode="decimal" placeholder="-68.42" />
          </label>
        </div>
        <p className="mt-1 text-xs text-brand-muted">Las dos juntas ponen la oportunidad en el mapa. El bot puede mandarlas al subir el sitio.</p>
        <label className={`${adminLabelClass} mt-4`}>
          Desarrollador
          <AdminInput value={desarrollador} onChange={(event) => setDesarrollador(event.target.value)} />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Unidades
            <AdminInput value={unidades} onChange={(event) => setUnidades(event.target.value)} inputMode="numeric" />
          </label>
          <label className={adminLabelClass}>
            Entrega
            <AdminInput value={entrega} onChange={(event) => setEntrega(event.target.value)} placeholder="2027" />
          </label>
        </div>
        <label className={`${adminLabelClass} mt-4`}>
          Por qué sirve para Quick
          <AdminTextarea value={porQue} onChange={(event) => setPorQue(event.target.value)} rows={2} />
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Fuente
          <AdminSelect value={fuente} onChange={(event) => setFuente(event.target.value)}>
            <option value="">Sin fuente</option>
            {EXPANSION_FUENTES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </AdminSelect>
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Web
          <AdminInput value={web} onChange={(event) => setWeb(event.target.value)} />
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Contacto
          <AdminSelect value={contactoId} onChange={(event) => setContactoId(event.target.value)}>
            <option value="">Sin contacto</option>
            {contactos.map((contacto) => (
              <option key={contacto.id} value={contacto.id}>
                {contacto.nombre} · {contacto.tipoLabel}
              </option>
            ))}
          </AdminSelect>
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Próximo paso
          <AdminInput value={proximaAccion} onChange={(event) => setProximaAccion(event.target.value)} placeholder="Llamar para confirmar la visita" />
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Fecha del próximo paso
          <AdminInput type="date" value={proximaFecha} onChange={(event) => setProximaFecha(event.target.value)} />
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Clave para el bot
          <AdminInput value={clave} onChange={(event) => setClave(event.target.value)} placeholder="piantini.local-12" />
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Detalle
          <AdminTextarea value={detalle} onChange={(event) => setDetalle(event.target.value)} rows={3} />
        </label>
        <FieldError message={formError} />
        <ModalActions onClose={onClose} saving={saving} label="Guardar sitio" />
      </form>
    </ModalFrame>
  );
}

function MetasModal({
  metas,
  onClose,
  onSaved,
}: {
  metas: ExpansionMeta[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(metas.map((meta) => [meta.id, String(meta.meta)]))
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload: Record<string, number> = {};
    for (const meta of metas) {
      const raw = values[meta.id]?.trim() ?? "";
      if (!/^\d+$/.test(raw)) {
        setFormError("Cada meta tiene que ser un número entero de 0 a 10000. 0 significa sin meta.");
        setSaving(false);
        return;
      }
      payload[meta.id] = Number(raw);
    }
    const response = await fetch("/api/admin/expansion/metas", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setFormError(await readError(response, "No pudimos guardar las metas"));
      setSaving(false);
      return;
    }
    await onSaved();
  }

  return (
    <ModalFrame title="Metas del pipeline" kicker="Expansión" onClose={onClose}>
      <form onSubmit={save}>
        <p className="mt-3 text-sm text-brand-muted">0 deja la meta apagada. El número de arriba en cada tarjeta es lo que hay ahora.</p>
        {metas.map((meta) => (
          <label key={meta.id} className={`${adminLabelClass} mt-4`}>
            {meta.etiqueta}
            <AdminInput
              inputMode="numeric"
              value={values[meta.id] ?? "0"}
              onChange={(event) => setValues((current) => ({ ...current, [meta.id]: event.target.value }))}
            />
            <span className="mt-1 block text-xs font-normal">{meta.ayuda}</span>
          </label>
        ))}
        <FieldError message={formError} />
        <ModalActions onClose={onClose} saving={saving} label="Guardar metas" />
      </form>
    </ModalFrame>
  );
}

function SitioDetalle({
  sitioId,
  contactos,
  onClose,
  onEdit,
  onChanged,
}: {
  sitioId: string;
  contactos: ExpansionContacto[];
  onClose: () => void;
  onEdit: (sitio: ExpansionSitio) => void;
  onChanged: () => Promise<void>;
}) {
  const [sitio, setSitio] = useState<ExpansionSitio | null>(null);
  const [actividades, setActividades] = useState<ExpansionActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<ExpansionTipoActividad>("nota");
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("");
  const [etapa, setEtapa] = useState<ExpansionEtapa>("identificado");
  const [proximaAccion, setProximaAccion] = useState("");
  const [proximaFecha, setProximaFecha] = useState("");

  const loadDetail = useCallback(async () => {
    const response = await fetch(`/api/admin/expansion/sitios/${sitioId}`, { credentials: "include" });
    if (!response.ok) {
      throw new Error(await readError(response, "No pudimos abrir el sitio"));
    }
    const body = (await response.json()) as { sitio: ExpansionSitio; actividades: ExpansionActividad[] };
    setSitio(body.sitio);
    setActividades(body.actividades);
    setEtapa(body.sitio.etapa);
    setProximaAccion(body.sitio.proximaAccion ?? "");
    setProximaFecha(body.sitio.proximaFecha ?? "");
  }, [sitioId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadDetail();
        if (!cancelled) {
          setFormError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setFormError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDetail]);

  async function saveActividad(event: FormEvent) {
    event.preventDefault();
    if (!sitio) {
      return;
    }
    setSaving(true);
    setFormError(null);
    const response = await fetch(`/api/admin/expansion/sitios/${sitio.id}/actividades`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        texto,
        fecha: fecha || undefined,
        etapa,
        proximaAccion,
        proximaFecha: proximaFecha || null,
      }),
    });
    if (!response.ok) {
      setFormError(await readError(response, "No pudimos guardar la actividad"));
      setSaving(false);
      return;
    }
    setTexto("");
    setFecha("");
    setTipo("nota");
    await loadDetail();
    await onChanged();
    setSaving(false);
  }

  const contacto = sitio?.contacto ? contactos.find((item) => item.id === sitio.contacto?.id) ?? sitio.contacto : null;

  return (
    <ModalFrame title={sitio?.nombre ?? "Oportunidad"} kicker="Oportunidad" onClose={onClose} layout="drawer">
      {loading ? (
        <div className="mt-5 h-24 animate-pulse rounded-lg bg-gray-100" />
      ) : !sitio ? (
        <FieldError message={formError || "No pudimos abrir el sitio"} />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <EtapaPill etapa={sitio.etapa} label={sitio.etapaLabel} />
            <span className="text-sm text-brand-muted">{sitio.tratoLabel}</span>
            {sitio.zona ? <span className="text-sm text-brand-muted">{sitio.zona}</span> : null}
          </div>
          <StageRail etapa={sitio.etapa} />
          <div className="mt-4 rounded-2xl px-4 py-3" style={{ backgroundColor: sitio.seguimientoVencido ? brand.paleOrange : brand.paleGreen }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              {sitio.seguimientoVencido ? "Seguimiento atrasado" : "Próximo paso"}
            </p>
            <p className="mt-1 font-semibold">{sitio.proximaAccion || "Sin definir"}</p>
            <p className="mt-1 text-sm text-brand-muted">
              {sitio.proximaFecha ? fechaCorta(sitio.proximaFecha) : "Sin fecha"} · en esta etapa desde {fechaCorta(sitio.etapaDesde)}
            </p>
          </div>
          {contacto ? (
            <p className="mt-1 text-sm">
              <span className="font-semibold">Contacto: </span>
              {contacto.nombre} · {contacto.tipoLabel}
              {contacto.telefono ? ` · ${contacto.telefono}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-brand-muted">Sin contacto enlazado.</p>
          )}
          {sitio.desarrollador ? (
            <p className="mt-1 text-sm">
              <span className="font-semibold">Desarrollador: </span>
              {sitio.desarrollador}
            </p>
          ) : null}
          {sitio.unidades != null || sitio.entrega ? (
            <p className="mt-1 text-sm">
              <span className="font-semibold">Escala: </span>
              {sitio.unidades != null ? `${sitio.unidades} unidades` : "unidades sin confirmar"}
              {sitio.entrega ? ` · entrega ${sitio.entrega}` : ""}
            </p>
          ) : null}
          {sitio.porQue ? <p className="mt-2 text-sm">{sitio.porQue}</p> : null}
          {sitio.fuenteLabel ? <p className="mt-1 text-sm text-brand-muted">Fuente: {sitio.fuenteLabel}</p> : null}
          {sitio.direccion ? <p className="mt-1 text-sm text-brand-muted">{sitio.direccion}</p> : null}
          {sitio.enMapa && sitio.lat != null && sitio.lng != null ? (
            <a
              className="mt-2 inline-block text-sm font-bold"
              style={{ color: brand.navy }}
              href={`https://www.google.com/maps?q=${sitio.lat},${sitio.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en Google Maps
            </a>
          ) : (
            <p className="mt-2 text-sm text-brand-muted">Sin ubicación en el mapa. Agrega latitud y longitud al editar.</p>
          )}
          {sitio.detalle ? <p className="mt-3 whitespace-pre-wrap text-sm text-brand-muted">{sitio.detalle}</p> : null}
          <button type="button" onClick={() => onEdit(sitio)} className="mt-3 text-sm font-bold" style={{ color: brand.green }}>
            Editar sitio
          </button>

          <h3 className="font-display mt-6 text-lg font-bold">Historial</h3>
          {actividades.length === 0 ? (
            <p className="mt-2 text-sm text-brand-muted">Todavía no hay llamadas, visitas ni notas.</p>
          ) : (
            <ul className="mt-4 border-l border-[#E5E7EB] pl-4">
              {actividades.map((actividad) => (
                <li key={actividad.id} className="relative pb-4">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-white" style={{ border: `2px solid ${brand.green}` }} />
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                    {actividad.tipoLabel} · {fechaCorta(actividad.fecha)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{actividad.texto}</p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={saveActividad} className="mt-5 border-t border-[#E5E7EB] pt-5">
            <h3 className="font-display text-lg font-bold">Anotar y mover</h3>
            <p className="mt-1 text-sm text-brand-muted">Una nota puede cambiar la etapa y el próximo paso al mismo tiempo.</p>
            <label className={`${adminLabelClass} mt-4`}>
              Tipo
              <AdminSelect value={tipo} onChange={(event) => setTipo(event.target.value as ExpansionTipoActividad)}>
                {EXPANSION_TIPOS_ACTIVIDAD.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className={`${adminLabelClass} mt-4`}>
              Qué pasó
              <AdminTextarea value={texto} onChange={(event) => setTexto(event.target.value)} rows={3} required />
            </label>
            <label className={`${adminLabelClass} mt-4`}>
              Fecha de la nota
              <AdminInput type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
            </label>
            <p className="mt-1 text-xs text-brand-muted">Si la dejas vacía, se guarda con la fecha de hoy.</p>
            <label className={`${adminLabelClass} mt-4`}>
              Dejar el sitio en
              <AdminSelect value={etapa} onChange={(event) => setEtapa(event.target.value as ExpansionEtapa)}>
                {EXPANSION_ETAPAS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className={`${adminLabelClass} mt-4`}>
              Próximo paso
              <AdminInput value={proximaAccion} onChange={(event) => setProximaAccion(event.target.value)} />
            </label>
            <label className={`${adminLabelClass} mt-4`}>
              Fecha del próximo paso
              <AdminInput type="date" value={proximaFecha} onChange={(event) => setProximaFecha(event.target.value)} />
            </label>
            <FieldError message={formError} />
            <ModalActions onClose={onClose} saving={saving} label="Guardar nota" />
          </form>
        </>
      )}
    </ModalFrame>
  );
}
