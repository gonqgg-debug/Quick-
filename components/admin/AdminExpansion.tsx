"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminInput, AdminSelect, AdminTextarea, adminLabelClass } from "@/components/admin/AdminField";
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

type Tab = "sitios" | "mapa" | "contactos";
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
  const [tab, setTab] = useState<Tab>("sitios");
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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Expansión</p>
          <h1 className="font-display mt-1 text-2xl font-bold">Pipeline</h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">
            Sitios, contactos y el próximo paso. El mapa muestra cada oportunidad con latitud y longitud. El bot escribe en esta misma lista.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditingMetas(true)}
            className="rounded-full px-4 text-sm font-bold"
            style={{ minHeight: 44, border: "1px solid #E5E7EB", color: brand.ink }}
          >
            Ajustar metas
          </button>
          <button
            type="button"
            onClick={() => setEditingContacto("new")}
            className="rounded-full px-4 text-sm font-bold"
            style={{ minHeight: 44, border: "1px solid #E5E7EB", color: brand.ink }}
          >
            Nuevo contacto
          </button>
          <button
            type="button"
            onClick={() => setEditingSitio("new")}
            className="rounded-full px-4 text-sm font-bold text-white"
            style={{ minHeight: 44, backgroundColor: brand.green }}
          >
            Nuevo sitio
          </button>
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
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-gray-100" />
      ) : pipeline ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pipeline.metas.map((meta) => (
              <article key={meta.id} className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{meta.etiqueta}</p>
                <p className="font-display mt-2 text-3xl font-bold tabular-nums">{meta.actual}</p>
                <p className="mt-1 text-sm text-brand-muted">
                  {meta.meta > 0 ? `Meta ${meta.meta} · ${metaEstado(meta)}` : metaEstado(meta)}
                </p>
              </article>
            ))}
            <button
              type="button"
              onClick={() => {
                setTab("sitios");
                setSoloVencidos((current) => !current);
                setEtapa("todas");
              }}
              className="rounded-lg border px-4 py-4 text-left"
              style={{
                borderColor: soloVencidos ? brand.orange : "#E5E7EB",
                backgroundColor: soloVencidos ? brand.paleOrange : "#fff",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Seguimientos vencidos</p>
              <p className="font-display mt-2 text-3xl font-bold tabular-nums" style={{ color: pipeline.seguimientosVencidos > 0 ? brand.orange : brand.ink }}>
                {pipeline.seguimientosVencidos}
              </p>
              <p className="mt-1 text-sm text-brand-muted">{soloVencidos ? "Mostrando solo estos" : "Toca para filtrarlos"}</p>
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={etapa === "todas" && !soloVencidos} onClick={() => { setEtapa("todas"); setSoloVencidos(false); }}>
              Todos
            </FilterChip>
            {pipeline.etapas.map((item) => (
              <FilterChip
                key={item.id}
                active={etapa === item.id}
                onClick={() => {
                  setEtapa(item.id);
                  setSoloVencidos(false);
                  setTab("sitios");
                }}
              >
                {item.label} {item.sitios}
              </FilterChip>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <TabButton active={tab === "sitios"} onClick={() => setTab("sitios")}>
              Sitios
            </TabButton>
            <TabButton active={tab === "mapa"} onClick={() => setTab("mapa")}>
              Mapa
            </TabButton>
            <TabButton active={tab === "contactos"} onClick={() => setTab("contactos")}>
              Contactos
            </TabButton>
          </div>

          {tab === "mapa" ? (
            <section className="mt-4">
              <AdminExpansionMap sitios={board?.sitios ?? []} onSelect={(id) => setOpenSitioId(id)} />
              <p className="mt-3 text-sm text-brand-muted">
                {(board?.sitios ?? []).filter((sitio) => sitio.enMapa).length} en el mapa
                {(board?.sitios ?? []).some((sitio) => !sitio.enMapa)
                  ? ` · ${(board?.sitios ?? []).filter((sitio) => !sitio.enMapa).length} sin latitud y longitud`
                  : ""}
              </p>
              {(board?.sitios ?? []).some((sitio) => !sitio.enMapa) ? (
                <ul className="mt-3 space-y-2">
                  {(board?.sitios ?? [])
                    .filter((sitio) => !sitio.enMapa)
                    .map((sitio) => (
                      <li key={sitio.id}>
                        <button type="button" onClick={() => setOpenSitioId(sitio.id)} className="text-left text-sm font-semibold" style={{ color: brand.navy }}>
                          {sitio.nombre}
                        </button>
                        <span className="text-sm text-brand-muted"> · {sitio.zona || "sin zona"} · falta ubicación</span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </section>
          ) : tab === "sitios" ? (
            <section className="mt-4">
              <AdminInput
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar sitio, zona, contacto o próximo paso"
                aria-label="Buscar sitios"
              />
              {sitios.length === 0 ? (
                <Empty
                  title={board?.sitios.length ? "Ningún sitio con ese filtro" : "Todavía no hay sitios"}
                  body={board?.sitios.length ? "Prueba otra etapa o limpia la búsqueda." : "Agrega el primero, o deja que el bot lo cree por la API."}
                />
              ) : (
                <DataTable className="mt-4" tableClassName="min-w-[860px]">
                  <DataTableHead>
                    <DataTableTh>Sitio</DataTableTh>
                    <DataTableTh>Zona</DataTableTh>
                    <DataTableTh>Trato</DataTableTh>
                    <DataTableTh>Etapa</DataTableTh>
                    <DataTableTh>Contacto</DataTableTh>
                    <DataTableTh>Próximo paso</DataTableTh>
                    <DataTableTh>Fecha</DataTableTh>
                  </DataTableHead>
                  <tbody>
                    {sitios.map((sitio) => (
                      <DataTableRow key={sitio.id}>
                        <DataTableCell>
                          <button type="button" onClick={() => setOpenSitioId(sitio.id)} className="text-left font-semibold" style={{ color: brand.navy }}>
                            {sitio.nombre}
                          </button>
                          {sitio.clave ? <p className="mt-0.5 text-xs text-brand-muted">{sitio.clave}</p> : null}
                        </DataTableCell>
                        <DataTableCell>{sitio.zona || "—"}</DataTableCell>
                        <DataTableCell>{sitio.tratoLabel}</DataTableCell>
                        <DataTableCell>
                          <EtapaPill etapa={sitio.etapa} label={sitio.etapaLabel} />
                        </DataTableCell>
                        <DataTableCell>{sitio.contacto?.nombre || "—"}</DataTableCell>
                        <DataTableCell className="max-w-[220px]">
                          <span className="line-clamp-2">{sitio.proximaAccion || "—"}</span>
                          {sitio.seguimientoVencido ? (
                            <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: brand.paleOrange, color: "#9A3412" }}>
                              Atrasado
                            </span>
                          ) : null}
                        </DataTableCell>
                        <DataTableCell className="whitespace-nowrap tabular-nums">{fechaCorta(sitio.proximaFecha)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </section>
          ) : (
            <section className="mt-4">
              <AdminInput
                value={contactoQ}
                onChange={(event) => setContactoQ(event.target.value)}
                placeholder="Buscar nombre, empresa, teléfono o correo"
                aria-label="Buscar contactos"
              />
              {contactos.length === 0 ? (
                <Empty
                  title={board?.contactos.length ? "Ningún contacto con esa búsqueda" : "Todavía no hay contactos"}
                  body="Brokers, desarrolladores, administraciones y propietarios viven aquí, aparte de los clientes de la tienda."
                />
              ) : (
                <DataTable className="mt-4" tableClassName="min-w-[760px]">
                  <DataTableHead>
                    <DataTableTh>Nombre</DataTableTh>
                    <DataTableTh>Tipo</DataTableTh>
                    <DataTableTh>Empresa</DataTableTh>
                    <DataTableTh>Teléfono</DataTableTh>
                    <DataTableTh>Correo</DataTableTh>
                    <DataTableTh className="w-24">
                      <span className="sr-only">Editar</span>
                    </DataTableTh>
                  </DataTableHead>
                  <tbody>
                    {contactos.map((contacto) => (
                      <DataTableRow key={contacto.id}>
                        <DataTableCell className="font-semibold">
                          {contacto.nombre}
                          {contacto.clave ? <p className="mt-0.5 text-xs font-normal text-brand-muted">{contacto.clave}</p> : null}
                        </DataTableCell>
                        <DataTableCell>{contacto.tipoLabel}</DataTableCell>
                        <DataTableCell>{contacto.empresa || "—"}</DataTableCell>
                        <DataTableCell>
                          {contacto.telefono ? (
                            <a href={`tel:${contacto.telefono}`} className="font-semibold" style={{ color: brand.navy }}>
                              {contacto.telefono}
                            </a>
                          ) : (
                            "—"
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          {contacto.email ? (
                            <a href={`mailto:${contacto.email}`} className="font-semibold" style={{ color: brand.navy }}>
                              {contacto.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          <button type="button" onClick={() => setEditingContacto(contacto)} className="text-sm font-bold" style={{ color: brand.green }}>
                            Editar
                          </button>
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </section>
          )}
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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-3 text-sm font-bold"
      style={{
        minHeight: 36,
        backgroundColor: active ? brand.ink : "#F3F4F6",
        color: active ? "#fff" : brand.ink,
      }}
    >
      {children}
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 text-sm font-bold"
      style={{
        minHeight: 40,
        backgroundColor: active ? brand.paleGreen : "transparent",
        color: brand.ink,
        border: active ? `1px solid ${brand.green}` : "1px solid transparent",
      }}
    >
      {children}
    </button>
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

function ModalFrame({ title, kicker, onClose, children }: { title: string; kicker: string; onClose: () => void; children: ReactNode }) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-6 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expansion-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6"
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
    <ModalFrame title={sitio?.nombre ?? "Sitio"} kicker="Seguimiento" onClose={onClose}>
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
            {sitio.seguimientoVencido ? (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: brand.paleOrange, color: "#9A3412" }}>
                Atrasado
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm">
            <span className="font-semibold">En esta etapa desde </span>
            {fechaCorta(sitio.etapaDesde)}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">Próximo paso: </span>
            {sitio.proximaAccion || "Sin definir"}
            {sitio.proximaFecha ? ` · ${fechaCorta(sitio.proximaFecha)}` : ""}
          </p>
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
            <ul className="mt-3 space-y-3">
              {actividades.map((actividad) => (
                <li key={actividad.id} className="rounded-lg px-3 py-3" style={{ backgroundColor: "#F8FAF7" }}>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
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
