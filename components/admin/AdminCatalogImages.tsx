"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogImageQueueItem, CatalogImageStats } from "@/lib/product-images-shared";
import { brand } from "@/lib/theme";

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

  async function runBatch() {
    setScanning(true);
    setError(null);
    scanStop.current = false;
    let foundTotal = 0;
    let scannedTotal = 0;
    try {
      for (;;) {
        if (scanStop.current) {
          break;
        }
        const response = await fetch("/api/admin/catalogo/imagenes/suggest", {
          method: "POST",
          credentials: "include",
        });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const body = (await response.json().catch(() => null)) as {
          scanned?: number;
          found?: number;
          remaining?: number;
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(body?.error || "Falló la búsqueda");
        }
        scannedTotal += body?.scanned ?? 0;
        foundTotal += body?.found ?? 0;
        setScanNote(`Revisados ${scannedTotal}. Sugerencias nuevas: ${foundTotal}. Quedan ${body?.remaining ?? 0}.`);
        await load();
        if (!body?.remaining || (body.scanned ?? 0) === 0) {
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
      await load();
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

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Catálogo</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Imágenes</h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">
            Capa 1: Open Food Facts sugiere fotos por código de barras. Nada se publica hasta que pulses “Usar esta”
            o subas una imagen.
          </p>
        </div>
        <button
          type="button"
          disabled={scanning || !stats || stats.awaitingOff === 0}
          onClick={() => void runBatch()}
          className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-40"
          style={{ backgroundColor: brand.orange, minHeight: 44 }}
        >
          {scanning ? "Buscando..." : "Buscar sugerencias OFF"}
        </button>
      </div>

      {stats ? (
        <p className="mt-4 text-sm font-bold" style={{ color: brand.green }}>
          {confirmedLabel}
        </p>
      ) : null}
      {stats ? (
        <p className="mt-1 text-sm text-brand-muted">
          {stats.withBarcode} con código de barras · {stats.awaitingOff} pendientes de consultar OFF ·{" "}
          {stats.pendingReview} en cola de revisión · {stats.withoutBarcode} sin código de barras
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
          <p className="mt-2 text-sm text-brand-muted">
            Cuando importes el catálogo con códigos de barras, aquí se llena la cola de revisión.
          </p>
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
                      Sugerida por Open Food Facts
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
                  Buscar otra opción
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
              {!item.suggestion && !item.codigoBarras ? (
                <p className="mt-2 text-xs text-brand-muted">
                  Open Food Facts necesita un código de barras. Impórtalo en el Excel (columna barcode / EAN).
                </p>
              ) : null}
              {!item.suggestion && item.codigoBarras ? (
                <p className="mt-2 text-xs text-brand-muted">
                  Sin foto en Open Food Facts. La búsqueda web (Capa 2) va en el siguiente paso.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
