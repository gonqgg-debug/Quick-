"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { CatalogImageQueueItem, CatalogImageStats } from "@/lib/product-images-shared";
import { brand } from "@/lib/theme";

const TEST_WEB_LIMIT = 8;

export function AdminCatalogImages() {
  const router = useRouter();
  const [stats, setStats] = useState<CatalogImageStats | null>(null);
  const [queue, setQueue] = useState<CatalogImageQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [moreOptionsItem, setMoreOptionsItem] = useState<CatalogImageQueueItem | null>(null);
  const scanStop = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/catalogo/imagenes", { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "No pudimos cargar la cola");
    }
    const body = (await response.json()) as { stats: CatalogImageStats; queue: CatalogImageQueueItem[] };
    setStats(body.stats);
    setQueue(body.queue);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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

  async function postSuggest(payload: { layer?: "off" | "web" | "auto"; limit?: number; productId?: string }) {
    const response = await fetch("/api/admin/catalogo/imagenes/suggest", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      throw new Error("Sesión expirada");
    }
    const body = (await response.json().catch(() => null)) as {
      layer?: string;
      scanned?: number;
      found?: number;
      missed?: number;
      remaining?: number;
      details?: Array<{ nombre: string; found: boolean; reason: string }>;
      error?: string;
    } | null;
    if (!response.ok) {
      throw new Error(body?.error || "Falló la búsqueda");
    }
    return body ?? {};
  }

  async function runBatch(kind: "auto" | "web-test") {
    setScanning(true);
    setError(null);
    scanStop.current = false;
    let foundTotal = 0;
    let scannedTotal = 0;
    let missedTotal = 0;
    try {
      if (kind === "web-test") {
        const detailLines: string[] = [];
        while (scannedTotal < TEST_WEB_LIMIT && !scanStop.current) {
          const body = await postSuggest({
            layer: "web",
            limit: Math.min(3, TEST_WEB_LIMIT - scannedTotal),
          });
          scannedTotal += body.scanned ?? 0;
          foundTotal += body.found ?? 0;
          missedTotal += body.missed ?? 0;
          for (const row of body.details ?? []) {
            detailLines.push(`${row.found ? "sí" : "no"} — ${row.nombre}`);
          }
          setScanNote(
            `Prueba web: ${scannedTotal}/${TEST_WEB_LIMIT}. ${foundTotal} sugerencias, ${missedTotal} sin buena foto. Quedan ${body.remaining ?? 0}.`
          );
          await load();
          if ((body.scanned ?? 0) === 0) {
            break;
          }
        }
        if (detailLines.length > 0) {
          setScanNote(
            `Prueba web: ${scannedTotal} productos. ${foundTotal} sugerencias, ${missedTotal} sin buena foto. ${detailLines.join(" · ")}`
          );
        }
        return;
      }
      for (;;) {
        if (scanStop.current) {
          break;
        }
        const body = await postSuggest({ layer: "auto" });
        scannedTotal += body.scanned ?? 0;
        foundTotal += body.found ?? 0;
        missedTotal += body.missed ?? 0;
        const layerLabel = body.layer === "web" ? "web" : "OFF";
        setScanNote(
          `${layerLabel}: revisados ${scannedTotal}. Sugerencias ${foundTotal}, sin match ${missedTotal}. Quedan ${body.remaining ?? 0}.`
        );
        await load();
        if (!body.remaining || (body.scanned ?? 0) === 0) {
          break;
        }
      }
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Error al buscar");
    } finally {
      setScanning(false);
    }
  }

  async function accept(suggestionId: string, productId: string) {
    setBusyId(productId);
    setError(null);
    try {
      const response = await fetch("/api/admin/catalogo/imagenes/accept", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos usar esa foto");
      }
      await load();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Error al guardar");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(suggestionId: string, productId: string) {
    setBusyId(productId);
    setError(null);
    try {
      const response = await fetch("/api/admin/catalogo/imagenes/reject", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });
      if (!response.ok) {
        throw new Error("No pudimos descartar la sugerencia");
      }
      setScanNote("Buscando otra opción en la web…");
      await postSuggest({ productId });
      await load();
      setScanNote(null);
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function upload(productId: string, file: File) {
    setBusyId(productId);
    setError(null);
    try {
      const body = new FormData();
      body.append("productId", productId);
      body.append("file", file);
      const response = await fetch("/api/admin/catalogo/imagenes/upload", {
        method: "POST",
        credentials: "include",
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "No pudimos subir la imagen");
      }
      await load();
      return true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Error al subir");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const canBatch = Boolean(stats && (stats.awaitingOff > 0 || stats.awaitingWeb > 0));
  const pendingSearch = stats ? stats.awaitingOff + stats.awaitingWeb : 0;
  const canWebTest = Boolean(stats && stats.awaitingWeb > 0);
  const progress = stats && stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
  const allHaveSuggestions = Boolean(stats && pendingSearch === 0 && stats.pendingReview > 0);
  const webDisabledReason = scanning
    ? undefined
    : !stats
      ? undefined
      : canWebTest
        ? undefined
        : allHaveSuggestions
          ? "No hay productos pendientes de buscar — todos los productos disponibles ya tienen una sugerencia esperando revisión."
          : stats.awaitingOff > 0
            ? `No hay productos pendientes de Capa 2 (web). “Buscar sugerencias” todavía puede consultar Open Food Facts (${stats.awaitingOff} pendientes).`
            : "No hay productos pendientes de buscar en la web.";
  const batchDisabledReason = scanning
    ? undefined
    : !stats
      ? undefined
      : canBatch
        ? undefined
        : allHaveSuggestions
          ? "No hay productos pendientes de buscar — todos los productos disponibles ya tienen una sugerencia esperando revisión."
          : "No hay productos pendientes de buscar.";

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Catálogo</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Imágenes</h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">
            Capa 1: Open Food Facts por código de barras. Capa 2: búsqueda web + IA. Nada se publica hasta “Usar esta”
            o una subida manual.
          </p>
          <p className="mt-2 max-w-xl text-sm text-brand-muted">
            <span className="font-semibold text-brand-ink">Probar 8 en web</span> es una muestra chica de Capa 2 (hasta{" "}
            {TEST_WEB_LIMIT} productos). <span className="font-semibold text-brand-ink">Buscar sugerencias</span> recorre
            todo lo pendiente: primero Open Food Facts y después la web. Si la sugerencia automática está cerca pero no
            es la variante exacta, usa <span className="font-semibold text-brand-ink">Buscar más opciones</span> en la
            tarjeta.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <span title={webDisabledReason} className="inline-flex">
              <button
                type="button"
                disabled={scanning || !canWebTest}
                onClick={() => void runBatch("web-test")}
                className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
                style={{ backgroundColor: "#F3F4F6", minHeight: 44 }}
              >
                {scanning
                  ? "Buscando..."
                  : `Probar ${TEST_WEB_LIMIT} en web (${stats ? stats.awaitingWeb : 0} pendientes)`}
              </button>
            </span>
            <span title={batchDisabledReason} className="inline-flex">
              <button
                type="button"
                disabled={scanning || !canBatch}
                onClick={() => void runBatch("auto")}
                className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: brand.orange, minHeight: 44 }}
              >
                {scanning ? "Buscando..." : `Buscar sugerencias (${pendingSearch} pendientes)`}
              </button>
            </span>
          </div>
          {webDisabledReason || batchDisabledReason ? (
            <p className="max-w-sm text-right text-xs text-brand-muted">{batchDisabledReason || webDisabledReason}</p>
          ) : null}
        </div>
      </div>

      {stats ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-bold" style={{ color: brand.green }}>
              {progress}% del catálogo con foto
            </p>
            <p className="text-brand-muted">
              {stats.confirmed.toLocaleString("es-DO")} de {stats.total.toLocaleString("es-DO")}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${progress}%`, backgroundColor: brand.green }}
            />
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <StatChip
              value={`${stats.confirmed.toLocaleString("es-DO")}/${stats.total.toLocaleString("es-DO")}`}
              label="Con foto confirmada"
            />
            <StatChip value={stats.pendingReview} label="En cola" />
            <StatChip value={stats.awaitingOff} label="Pendientes OFF" />
            <StatChip value={stats.awaitingWeb} label="Pendientes web" />
            <StatChip value={stats.withoutBarcode} label="Sin código de barras" />
          </ul>
        </div>
      ) : null}
      {scanNote ? <p className="mt-2 text-sm font-semibold">{scanNote}</p> : null}

      {error ? (
        <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-48 animate-pulse rounded-[24px] bg-gray-100" />
      ) : queue.length === 0 ? (
        <div className="mt-6 rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="font-display text-xl font-bold">No hay productos pendientes de foto</p>
          <p className="mt-2 text-sm text-brand-muted">Cuando importes más catálogo, aquí se llena la cola.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {queue.map((item) => (
            <li key={item.id} className="flex flex-col rounded-[24px] border p-3" style={{ borderColor: "#E5E7EB" }}>
              <div
                className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl"
                style={{ backgroundColor: "#F3F4F6" }}
              >
                {item.suggestion ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.suggestion.imageUrl} alt="" className="h-full w-full object-contain" />
                ) : item.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.fotoUrl} alt="" className="h-full w-full object-contain opacity-60" />
                ) : (
                  <span className="px-2 text-center text-xs text-brand-muted">Sin sugerencia</span>
                )}
              </div>
              <div className="mt-3 flex min-h-[8rem] flex-1 flex-col">
                <p className="font-display text-lg font-bold leading-tight">{item.nombre}</p>
                <p className="mt-1 text-sm text-brand-muted">{productMeta(item.marca, item.categoria)}</p>
                <p className="mt-1 font-mono text-xs text-brand-muted">
                  {item.codigoBarras ? `EAN ${item.codigoBarras}` : "Sin código de barras"}
                </p>
                {item.suggestion ? (
                  <p className="mt-1 text-xs font-semibold" style={{ color: brand.green }}>
                    {item.suggestion.source === "web" ? "Sugerida por búsqueda web" : "Sugerida por Open Food Facts"}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-brand-muted">
                    {item.codigoBarras
                      ? "Sin foto de Open Food Facts. Usa “Buscar sugerencias” para intentar la web."
                      : "Sin código de barras: la Capa 2 busca por nombre y marca."}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
                  <button
                    type="button"
                    disabled={busyId === item.id || !item.suggestion}
                    onClick={() => item.suggestion && void accept(item.suggestion.id, item.id)}
                    className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-40"
                    style={{ backgroundColor: brand.green, minHeight: 40 }}
                  >
                    Usar esta
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setMoreOptionsItem(item)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-semibold disabled:opacity-40"
                    style={{ minHeight: 40, borderColor: "#E5E7EB" }}
                  >
                    <SearchIcon />
                    Buscar más opciones
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id || !item.suggestion}
                    onClick={() => item.suggestion && void reject(item.suggestion.id, item.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold disabled:opacity-40"
                    style={{ minHeight: 40 }}
                  >
                    {busyId === item.id ? "Buscando..." : "Buscar otra"}
                  </button>
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold"
                    style={{ color: brand.blue, minHeight: 40 }}
                  >
                    <UploadGlyph />
                    Subir
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={busyId === item.id}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) {
                          void upload(item.id, file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreOptionsItem && typeof document !== "undefined"
        ? createPortal(
            <MoreOptionsModal
              key={moreOptionsItem.id}
              item={moreOptionsItem}
              onClose={() => setMoreOptionsItem(null)}
              onApplied={async () => {
                setMoreOptionsItem(null);
                await load();
              }}
              onUpload={async (file) => {
                const ok = await upload(moreOptionsItem.id, file);
                if (!ok) {
                  throw new Error("No pudimos subir la imagen");
                }
                setMoreOptionsItem(null);
              }}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function defaultImageQuery(item: CatalogImageQueueItem): string {
  return [item.marca, item.nombre].map((part) => part?.trim()).filter(Boolean).join(" ");
}

function MoreOptionsModal({
  item,
  onClose,
  onApplied,
  onUpload,
}: {
  item: CatalogImageQueueItem;
  onClose: () => void;
  onApplied: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}) {
  const [query, setQuery] = useState(defaultImageQuery(item));
  const [images, setImages] = useState<Array<{ url: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const searched = useRef(false);

  const search = useCallback(async (nextQuery: string) => {
    const q = nextQuery.trim();
    if (q.length < 2) {
      setError("Escribe un término de búsqueda");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/catalogo/imagenes/search", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const body = (await response.json().catch(() => null)) as {
        images?: Array<{ url: string; title: string }>;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos buscar imágenes");
      }
      setImages(body?.images ?? []);
      if ((body?.images ?? []).length === 0) {
        setError("No encontramos imágenes para esa búsqueda. Prueba afinar el texto.");
      }
    } catch (searchError) {
      setImages([]);
      setError(searchError instanceof Error ? searchError.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!searched.current) {
      searched.current = true;
      void search(defaultImageQuery(item));
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [item, onClose, search]);

  async function apply(imageUrl: string) {
    setApplying(imageUrl);
    setError(null);
    try {
      const response = await fetch("/api/admin/catalogo/imagenes/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.id, imageUrl }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos usar esa foto");
      }
      await onApplied();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Error al guardar");
    } finally {
      setApplying(null);
    }
  }

  const busy = loading || Boolean(applying) || uploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-options-title"
        className="relative z-10 flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
      >
        <div className="overflow-y-auto px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Buscar más opciones</p>
          <h2 id="more-options-title" className="mt-1 font-display text-2xl font-bold leading-tight">
            {item.nombre}
          </h2>
          <p className="mt-1 text-sm text-brand-muted">{productMeta(item.marca, item.categoria)}</p>
          <p className="mt-3 text-sm text-brand-muted">
            Tú eliges la foto. Afina la búsqueda si hace falta el tamaño o la variante exacta.
          </p>

          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void search(query);
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Marca y nombre del producto"
              className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-[#7EB341]"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
              style={{ minHeight: 44, backgroundColor: brand.green }}
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
              {error}
            </p>
          ) : null}

          {loading && images.length === 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : images.length > 0 ? (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image) => (
                <li key={image.url} className="flex flex-col overflow-hidden rounded-2xl border" style={{ borderColor: "#E5E7EB" }}>
                  <div className="flex h-40 items-center justify-center bg-[#F3F4F6] sm:h-44">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.title || ""} className="h-full w-full object-contain" />
                  </div>
                  <div className="p-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void apply(image.url)}
                      className="w-full rounded-full px-3 text-sm font-bold text-white disabled:opacity-40"
                      style={{ minHeight: 40, backgroundColor: brand.green }}
                    >
                      {applying === image.url ? "Guardando..." : "Usar esta"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4" style={{ borderColor: "#EFEFEF" }}>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold" style={{ color: brand.blue }}>
            <UploadGlyph />
            {uploading ? "Subiendo..." : "Subir manual"}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) {
                  return;
                }
                setUploading(true);
                setError(null);
                void onUpload(file)
                  .catch((uploadError: unknown) => {
                    setError(uploadError instanceof Error ? uploadError.message : "Error al subir");
                  })
                  .finally(() => setUploading(false));
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-full border px-4 text-sm font-semibold disabled:opacity-40"
            style={{ minHeight: 44, borderColor: "#E5E7EB" }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function StatChip({ value, label }: { value: string | number; label: string }) {
  return (
    <li className="rounded-[20px] px-3 py-3" style={{ backgroundColor: "#F8FAF7", border: "1px solid #E5E7EB" }}>
      <p className="font-display text-xl font-bold leading-none" style={{ color: brand.ink }}>
        {typeof value === "number" ? value.toLocaleString("es-DO") : value}
      </p>
      <p className="mt-1.5 text-xs font-semibold text-brand-muted">{label}</p>
    </li>
  );
}

function productMeta(marca: string | null, categoria: string): string {
  const brandLabel = marca?.trim() || null;
  const categoryLabel = !categoria || /^(all|todos)$/i.test(categoria.trim()) ? "Sin categoría" : categoria.trim();
  if (brandLabel && categoryLabel) {
    return `${brandLabel} · ${categoryLabel}`;
  }
  return brandLabel || categoryLabel;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.2 10.2 13 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UploadGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 11.5V4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.2 6.7 8 4l2.8 2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 12.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
