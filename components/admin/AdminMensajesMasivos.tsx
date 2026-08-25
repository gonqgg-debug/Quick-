"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminInput, AdminTextarea, adminLabelClass } from "@/components/admin/AdminField";
import {
  WHATSAPP_TEXT_MAX,
  type MassMessagePreview,
  type MassMessageProgressEvent,
} from "@/lib/admin-mensajes-masivos-shared";
import { brand } from "@/lib/theme";

type PreviewSnapshot = {
  ultimoPedidoDesde: string;
  ultimoPedidoHasta: string;
  mensaje: string;
  count: number;
};

function audienceQuery(desde: string, hasta: string): string {
  const params = new URLSearchParams();
  if (desde) {
    params.set("ultimoPedidoDesde", desde);
  }
  if (hasta) {
    params.set("ultimoPedidoHasta", hasta);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function readNdjson(
  response: Response,
  onEvent: (event: MassMessageProgressEvent) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("No recibimos el progreso del envío");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      onEvent(JSON.parse(line) as MassMessageProgressEvent);
    }
  }
  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as MassMessageProgressEvent);
  }
}

export function AdminMensajesMasivos() {
  const router = useRouter();
  const [totalMarketing, setTotalMarketing] = useState<number | null>(null);
  const [ultimoPedidoDesde, setUltimoPedidoDesde] = useState("");
  const [ultimoPedidoHasta, setUltimoPedidoHasta] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [preview, setPreview] = useState<PreviewSnapshot | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const loadAudience = useCallback(async () => {
    const response = await fetch(`/api/admin/clientes/mensajes-masivos${audienceQuery("", "")}`, {
      credentials: "include",
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as (MassMessagePreview & { error?: string }) | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar la audiencia");
    }
    setTotalMarketing(body?.totalMarketing ?? body?.count ?? 0);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAudience();
        if (!cancelled) {
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No pudimos cargar la audiencia");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAudience]);

  const previewMatches =
    preview != null &&
    preview.ultimoPedidoDesde === ultimoPedidoDesde &&
    preview.ultimoPedidoHasta === ultimoPedidoHasta &&
    preview.mensaje === mensaje.trim();

  async function handlePreview() {
    setPreviewing(true);
    setError(null);
    setDoneMessage(null);
    setProgress(null);
    try {
      const response = await fetch(
        `/api/admin/clientes/mensajes-masivos${audienceQuery(ultimoPedidoDesde, ultimoPedidoHasta)}`,
        { credentials: "include" }
      );
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as (MassMessagePreview & { error?: string }) | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos calcular la audiencia");
      }
      setTotalMarketing(body?.totalMarketing ?? totalMarketing);
      setPreview({
        ultimoPedidoDesde,
        ultimoPedidoHasta,
        mensaje: mensaje.trim(),
        count: body?.count ?? 0,
      });
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "No pudimos calcular la audiencia");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    if (!previewMatches || !preview || preview.count === 0) {
      return;
    }
    setConfirmOpen(false);
    setSending(true);
    setError(null);
    setDoneMessage(null);
    setProgress({ sent: 0, failed: 0, skipped: 0, total: preview.count });
    try {
      const response = await fetch("/api/admin/clientes/mensajes-masivos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmar: true,
          mensaje: mensaje.trim(),
          ultimoPedidoDesde: ultimoPedidoDesde || null,
          ultimoPedidoHasta: ultimoPedidoHasta || null,
        }),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("ndjson")) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos enviar los mensajes");
      }
      await readNdjson(response, (event) => {
        if (event.type === "error") {
          throw new Error(event.error);
        }
        if (event.type === "start") {
          setProgress({ sent: 0, failed: 0, skipped: 0, total: event.total });
          return;
        }
        const next = {
          sent: event.sent,
          failed: event.failed,
          skipped: event.skipped,
          total: event.total,
        };
        setProgress(next);
        if (event.type === "done") {
          const parts = [`${next.sent} de ${next.total} enviados`];
          if (next.failed) {
            parts.push(`${next.failed} con error`);
          }
          if (next.skipped) {
            parts.push(`${next.skipped} omitidos (ya no aceptan marketing)`);
          }
          setDoneMessage(parts.join(" · "));
        }
      });
      setPreview(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "No pudimos enviar los mensajes");
    } finally {
      setSending(false);
    }
  }

  const remaining = WHATSAPP_TEXT_MAX - mensaje.length;
  const canPreview = Boolean(mensaje.trim()) && !previewing && !sending;
  const canSend = previewMatches && preview != null && preview.count > 0 && !sending;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Clientes</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Mensajes masivos</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Solo a quien acepta marketing. Quien dijo que no nunca entra en esta lista.
      </p>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {doneMessage ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: `${brand.green}22`, color: brand.ink }}>
          {doneMessage}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border p-5" style={{ borderColor: "#E5E7EB" }}>
        <h2 className="text-sm font-bold">Audiencia</h2>
        <div
          className="mt-3 rounded-2xl border-2 px-4 py-3"
          style={{ borderColor: brand.green, backgroundColor: `${brand.green}14` }}
        >
          <p className="font-semibold">Todos los que aceptan marketing</p>
          <p className="mt-0.5 text-sm text-brand-muted">
            {totalMarketing == null ? "Contando…" : `${totalMarketing} ${totalMarketing === 1 ? "persona" : "personas"}`}
          </p>
        </div>

        <p className={`${adminLabelClass} mt-5`}>Filtro opcional: último pedido entre</p>
        <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-brand-muted">Desde</span>
            <AdminInput
              type="date"
              bare
              className="mt-1"
              value={ultimoPedidoDesde}
              onChange={(event) => {
                setUltimoPedidoDesde(event.target.value);
                setPreview(null);
              }}
              disabled={sending}
            />
          </label>
          <label className="block">
            <span className="text-xs text-brand-muted">Hasta</span>
            <AdminInput
              type="date"
              bare
              className="mt-1"
              value={ultimoPedidoHasta}
              onChange={(event) => {
                setUltimoPedidoHasta(event.target.value);
                setPreview(null);
              }}
              disabled={sending}
            />
          </label>
        </div>
      </section>

      <section className="mt-5 rounded-lg border p-5" style={{ borderColor: "#E5E7EB" }}>
        <label className={adminLabelClass} htmlFor="mensaje-masivo">
          Mensaje
        </label>
        <AdminTextarea
          id="mensaje-masivo"
          rows={6}
          maxLength={WHATSAPP_TEXT_MAX}
          value={mensaje}
          disabled={sending}
          onChange={(event) => {
            setMensaje(event.target.value);
            setPreview(null);
          }}
          placeholder="Escribe el texto que van a recibir"
        />
        <p className="mt-1 text-right text-xs text-brand-muted">
          {remaining} caracteres restantes
        </p>
        <p
          className="mt-3 rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={{ backgroundColor: "#FFF7ED", color: "#9A3412" }}
        >
          Si ha pasado más de 24h desde que el cliente te escribió por última vez, este mensaje debe
          corresponder a una plantilla ya aprobada por Meta — un texto libre no aprobado puede fallar o
          no entregarse.
        </p>
      </section>

      {previewMatches && preview ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#F8FAF7" }}>
          Les llegaría a <span className="font-bold">{preview.count}</span>{" "}
          {preview.count === 1 ? "persona" : "personas"}.
        </p>
      ) : null}

      {progress && sending ? (
        <div className="mt-4 rounded-2xl px-4 py-3" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="text-sm font-semibold">
            {progress.sent} de {progress.total} enviados
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress.total ? Math.round(((progress.sent + progress.failed + progress.skipped) / progress.total) * 100) : 0}%`,
                backgroundColor: brand.green,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canPreview}
          onClick={() => void handlePreview()}
          className="rounded-full border px-4 text-sm font-bold disabled:opacity-40"
          style={{ minHeight: 44, borderColor: "#E5E7EB", color: brand.ink }}
        >
          {previewing ? "Calculando…" : "Vista previa"}
        </button>
        <button
          type="button"
          disabled={!canSend}
          onClick={() => setConfirmOpen(true)}
          className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-40"
          style={{ minHeight: 44, backgroundColor: brand.green }}
        >
          Enviar
        </button>
      </div>
      {!previewMatches && mensaje.trim() ? (
        <p className="mt-2 text-xs text-brand-muted">Usa Vista previa antes de enviar. Si cambias el texto o las fechas, hay que volver a previsualizar.</p>
      ) : null}

      {confirmOpen && preview ? (
        <ConfirmSendModal
          count={preview.count}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleSend()}
        />
      ) : null}
    </div>
  );
}

function ConfirmSendModal({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Cerrar" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-send-title"
        className="relative z-10 w-full max-w-md rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)" }}
      >
        <h2 id="confirm-send-title" className="font-display text-xl font-bold">
          ¿Confirmas que vas a enviarle esto a {count} {count === 1 ? "persona" : "personas"}?
        </h2>
        <p className="mt-2 text-sm text-brand-muted">Este paso no se puede deshacer.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border px-4 text-sm font-semibold"
            style={{ minHeight: 44, borderColor: "#E5E7EB" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full px-4 text-sm font-bold text-white"
            style={{ minHeight: 44, backgroundColor: brand.green }}
          >
            Sí, enviar
          </button>
        </div>
      </div>
    </div>
  );
}
