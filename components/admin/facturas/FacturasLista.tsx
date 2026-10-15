"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/DataTable";
import { AdminInput } from "@/components/admin/AdminField";
import { FACTURA_ESTADOS, FACTURAS_PAGE_SIZE, formatMonto, type FacturaEstado, type FacturaResumen, type FacturasResumen } from "@/lib/facturas-shared";
import { brand } from "@/lib/theme";
import { guardarLista } from "@/components/admin/facturas/lista-guardada";
import { ETAPAS_CAMINO, TONO, estadoCorto, estadoTono, fechaCorta, fechaHora, pasoDeEtapa, Pill } from "@/components/admin/facturas/ui";

type Vista = "atencion" | "todas" | FacturaEstado;

const VISTAS: Array<{ id: Vista; label: string }> = [
  { id: "atencion", label: "Atención" },
  ...FACTURA_ESTADOS.map((item) => ({ id: item.id as Vista, label: item.corto })),
  { id: "todas", label: "Todas" },
];

function vistaDesde(value: string | null): Vista {
  return VISTAS.some((item) => item.id === value) ? (value as Vista) : "atencion";
}

function conteo(vista: Vista, resumen: FacturasResumen | null): number | null {
  if (!resumen) {
    return null;
  }
  if (vista === "atencion") {
    return resumen.atencion;
  }
  if (vista === "todas") {
    return resumen.total;
  }
  return resumen.porEstado.find((item) => item.id === vista)?.facturas ?? 0;
}

function apiQuery(vista: Vista, q: string, page: number): string {
  const params = new URLSearchParams();
  if (vista === "atencion") {
    params.set("atencion", "true");
  } else if (vista !== "todas") {
    params.set("estado", vista);
  }
  if (q.trim()) {
    params.set("q", q.trim());
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  return params.toString();
}

export function FacturasLista() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const vista = vistaDesde(searchParams.get("vista"));
  const qUrl = searchParams.get("q") ?? "";
  const pageRaw = Number(searchParams.get("page") || "1");
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const [q, setQ] = useState(qUrl);
  const [facturas, setFacturas] = useState<FacturaResumen[]>([]);
  const [resumen, setResumen] = useState<FacturasResumen | null>(null);
  const [total, setTotal] = useState(0);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listaQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (vista !== "atencion") {
      params.set("vista", vista);
    }
    if (qUrl.trim()) {
      params.set("q", qUrl.trim());
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    return params.toString();
  }, [vista, qUrl, page]);

  function setUrl(next: { vista?: Vista; q?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextVista = next.vista ?? vista;
    const nextQ = next.q ?? qUrl;
    const nextPage = next.page ?? (next.vista || next.q != null ? 1 : page);
    if (nextVista === "atencion") {
      params.delete("vista");
    } else {
      params.set("vista", nextVista);
    }
    if (nextQ.trim()) {
      params.set("q", nextQ.trim());
    } else {
      params.delete("q");
    }
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    setQ(qUrl);
  }, [qUrl]);

  useEffect(() => {
    if (q.trim() === qUrl.trim()) {
      return;
    }
    const handle = window.setTimeout(() => setUrl({ q }), 300);
    return () => window.clearTimeout(handle);
    // setUrl reads the current params; only the typed text should retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    let idsDeLaVista = false;
    setRefreshing(true);
    const query = apiQuery(vista, qUrl, page);
    const idsQuery = apiQuery(vista, qUrl, 1);
    const idsParams = new URLSearchParams(idsQuery);
    idsParams.set("ids", "1");
    void fetch(`/api/admin/facturas?${idsParams}`, { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as { ids?: string[] };
        if (!response.ok || cancelled || !Array.isArray(body.ids)) {
          return;
        }
        idsDeLaVista = true;
        guardarLista({ ids: body.ids, query: listaQuery });
      })
      .catch(() => {
        /* la página visible igual deja una lista para anterior y siguiente */
      });
    void fetch(`/api/admin/facturas${query ? `?${query}` : ""}`, { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as {
          facturas?: FacturaResumen[];
          resumen?: FacturasResumen;
          total?: number;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || "No pudimos cargar las facturas");
        }
        if (!cancelled) {
          const rows = body.facturas ?? [];
          setFacturas(rows);
          setTotal(body.total ?? rows.length);
          setResumen(body.resumen ?? null);
          setError(null);
          if (!idsDeLaVista) {
            guardarLista({ ids: rows.map((row) => row.id), query: listaQuery });
          }
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "No pudimos cargar las facturas");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBooting(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vista, qUrl, page, listaQuery]);

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold">Facturas</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-muted">
          Una ficha por compra. Phillip registra, Boris verifica y Fred concilia. Atención junta lo que tiene problema, preguntas abiertas, posible duplicado o le falta la foto.
        </p>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-[#E7EBE4]" role="tablist" aria-label="Vistas de facturas">
        {VISTAS.map((item) => {
          const activa = item.id === vista;
          const n = conteo(item.id, resumen);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setUrl({ vista: item.id })}
              className="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold"
              style={{ borderColor: activa ? brand.green : "transparent", color: activa ? brand.ink : brand.muted }}
            >
              {item.label}
              {n != null ? (
                <span
                  className="rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                  style={item.id === "atencion" && n > 0 ? TONO.rojo : { backgroundColor: "#F3F4F6", color: brand.muted }}
                >
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 max-w-md">
        <AdminInput bare value={q} onChange={(event) => setQ(event.target.value)} placeholder="Proveedor, NCF, número, RNC o tienda" aria-label="Buscar factura" />
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        {booting ? (
          <div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        ) : facturas.length === 0 ? (
          <Vacio vista={vista} buscando={Boolean(qUrl.trim())} />
        ) : (
          <div className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <DataTable tableClassName="min-w-[760px]">
            <DataTableHead>
              <DataTableTh>Proveedor</DataTableTh>
              <DataTableTh>Fecha</DataTableTh>
              <DataTableTh numeric>Total</DataTableTh>
              <DataTableTh>Etapa</DataTableTh>
              <DataTableTh>Alertas</DataTableTh>
              <DataTableTh>Actualizada</DataTableTh>
            </DataTableHead>
            <tbody>
              {facturas.map((factura) => (
                <DataTableRow key={factura.id} onClick={() => router.push(`/admin/facturas/${factura.id}`)}>
                  <DataTableCell>
                    <Link href={`/admin/facturas/${factura.id}`} className="font-semibold hover:underline" onClick={(event) => event.stopPropagation()}>
                      {factura.proveedor || "Sin proveedor"}
                    </Link>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      {[factura.tienda, factura.ncf || factura.numeroFactura].filter(Boolean).join(" · ") || factura.tipoDocumentoLabel}
                    </p>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap">{fechaCorta(factura.fechaEmision ?? factura.recibidoEn)}</DataTableCell>
                  <DataTableCell numeric className="font-semibold">
                    {formatMonto(factura.total, factura.moneda)}
                  </DataTableCell>
                  <DataTableCell>
                    <EtapaMini estado={factura.estado} />
                  </DataTableCell>
                  <DataTableCell>
                    <Alertas factura={factura} />
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-brand-muted">{fechaHora(factura.actualizadoEn)}</DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
          </div>
        )}
      </div>

      {facturas.length > 0 || total > 0 ? <Paginacion page={page} total={total} onPage={(next) => setUrl({ page: next })} /> : null}
    </div>
  );
}

function Paginacion({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / FACTURAS_PAGE_SIZE));
  const fromRow = total === 0 ? 0 : (page - 1) * FACTURAS_PAGE_SIZE + 1;
  const toRow = Math.min(page * FACTURAS_PAGE_SIZE, total);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-brand-muted">
        {fromRow}–{toRow} de {total.toLocaleString("es-DO")}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
          style={{ minHeight: 40, backgroundColor: "#F3F4F6" }}
        >
          Anterior
        </button>
        <p className="text-sm font-semibold tabular-nums">
          {page} / {pageCount}
        </p>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPage(Math.min(pageCount, page + 1))}
          className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
          style={{ minHeight: 40, backgroundColor: "#F3F4F6" }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function EtapaMini({ estado }: { estado: FacturaEstado }) {
  const paso = pasoDeEtapa(estado);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Pill label={estadoCorto(estado)} tone={estadoTono(estado)} />
      <div className="flex gap-0.5" aria-hidden="true">
        {ETAPAS_CAMINO.map((item, index) => (
          <span
            key={item.id}
            className="h-1 w-5 rounded-full"
            style={{ backgroundColor: paso >= index ? brand.green : "#E5E7EB" }}
          />
        ))}
      </div>
    </div>
  );
}

function Alertas({ factura }: { factura: FacturaResumen }) {
  const items: Array<{ label: string; title: string; tone: (typeof TONO)[keyof typeof TONO] }> = [];
  if (factura.problema) {
    items.push({
      label: "Problema",
      title: [factura.problemaDueno ? `Lo tiene ${factura.problemaDueno}` : null, factura.problemaFalta].filter(Boolean).join(". "),
      tone: TONO.rojo,
    });
  }
  if (factura.preguntasAbiertas > 0) {
    items.push({
      label: factura.preguntasAbiertas === 1 ? "1 pregunta" : `${factura.preguntasAbiertas} preguntas`,
      title: "Preguntas abiertas",
      tone: TONO.naranja,
    });
  }
  if (factura.posibleDuplicado) {
    items.push({ label: "Duplicado", title: factura.duplicadoReferencia ? `Posible duplicado de ${factura.duplicadoReferencia}` : "Posible duplicado", tone: TONO.rojo });
  }
  if (!factura.tieneFoto) {
    items.push({ label: "Sin foto", title: "Todavía no está el documento original", tone: TONO.naranja });
  }
  if (factura.esCompraPersonal) {
    items.push({ label: "Personal", title: factura.socio ? `Compra personal de ${factura.socio}` : "Compra personal", tone: TONO.navy });
  }
  if (!items.length) {
    return <span className="text-brand-muted">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Pill key={item.label} label={item.label} tone={item.tone} title={item.title || undefined} />
      ))}
    </div>
  );
}

function Vacio({ vista, buscando }: { vista: Vista; buscando: boolean }) {
  const titulo = buscando ? "Ninguna factura coincide" : vista === "atencion" ? "Nada pide atención" : "No hay facturas en esta vista";
  const texto = buscando
    ? "Prueba con otro proveedor, NCF o tienda, o busca en Todas."
    : vista === "atencion"
      ? "Ninguna factura tiene problema, preguntas abiertas, posible duplicado ni le falta la foto."
      : "Cuando una factura llegue a esta etapa, aparece aquí.";
  return (
    <div className="rounded-2xl border border-dashed border-[#E7EBE4] px-6 py-16 text-center">
      <p className="font-display text-lg font-bold">{titulo}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">{texto}</p>
    </div>
  );
}
