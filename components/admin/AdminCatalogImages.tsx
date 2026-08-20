"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Error al subir");
    } finally {
      setBusyId(null);
    }
  }

  const confirmedLabel = stats
    ? `${stats.confirmed.toLocaleString("es-DO")} de ${stats.total.toLocaleString("es-DO")} con foto confirmada`
    : "";
  const canBatch = Boolean(stats && (stats.awaitingOff > 0 || stats.awaitingWeb > 0));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Catálogo</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Imágenes</h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">
            Capa 1: Open Food Facts. Capa 2: búsqueda web + IA. Nada se publica hasta “Usar esta” o una subida
            manual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={scanning || !stats || stats.awaitingWeb === 0}
            onClick={() => void runBatch("web-test")}
            className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
            style={{ backgroundColor: "#F3F4F6", minHeight: 44 }}
          >
            {scanning ? "Buscando..." : `Probar ${TEST_WEB_LIMIT} en web`}
          </button>
          <button
            type="button"
            disabled={scanning || !canBatch}
            onClick={() => void runBatch("auto")}
            className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-40"
            style={{ backgroundColor: brand.orange, minHeight: 44 }}
          >
            {scanning ? "Buscando..." : "Buscar sugerencias"}
          </button>
        </div>
      </div>

      {stats ? (
        <p className="mt-4 text-sm font-bold" style={{ color: brand.green }}>
          {confirmedLabel}
        </p>
      ) : null}
      {stats ? (
        <p className="mt-1 text-sm text-brand-muted">
          {stats.pendingReview} en cola · {stats.awaitingOff} pendientes OFF · {stats.awaitingWeb} pendientes web ·{" "}
          {stats.withoutBarcode} sin código de barras
        </p>
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
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {queue.map((item) => (
            <li key={item.id} className="rounded-[24px] border p-4" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex gap-4">
                <div
                  className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-50"
                  style={{ border: "1px solid #F3F4F6" }}
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
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold leading-tight">{item.nombre}</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {item.marca || "Sin marca"} · {item.categoria}
                  </p>
                  <p className="mt-1 font-mono text-xs text-brand-muted">
                    {item.codigoBarras ? `EAN ${item.codigoBarras}` : "Sin código de barras"}
                  </p>
                  {item.suggestion ? (
                    <p className="mt-1 text-xs font-semibold" style={{ color: brand.green }}>
                      {item.suggestion.source === "web" ? "Sugerida por búsqueda web" : "Sugerida por Open Food Facts"}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === item.id || !item.suggestion}
                  onClick={() => item.suggestion && void accept(item.suggestion.id, item.id)}
                  className="rounded-full px-3 text-sm font-bold text-white disabled:opacity-40"
                  style={{ backgroundColor: brand.green, minHeight: 40 }}
                >
                  Usar esta
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id || !item.suggestion}
                  onClick={() => item.suggestion && void reject(item.suggestion.id, item.id)}
                  className="rounded-full px-3 text-sm font-bold disabled:opacity-40"
                  style={{ backgroundColor: "#F3F4F6", minHeight: 40 }}
                >
                  {busyId === item.id ? "Buscando..." : "Buscar otra opción"}
                </button>
                <label
                  className="inline-flex cursor-pointer items-center rounded-full px-3 text-sm font-bold"
                  style={{ backgroundColor: "#F3F4F6", minHeight: 40 }}
                >
                  Subir manual
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
              {!item.suggestion ? (
                <p className="mt-2 text-xs text-brand-muted">
                  {item.codigoBarras
                    ? "Sin foto de Open Food Facts. Usa “Buscar sugerencias” para intentar la web."
                    : "Sin código de barras: la Capa 2 busca por nombre y marca."}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
