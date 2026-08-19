"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatOrderNumber, orderStatusLabel } from "@/lib/order-display";
import { brand } from "@/lib/theme";

type ChatMessage = {
  id: string;
  direccion: string;
  contenido: string;
  createdAt: string;
};

type ChatInfo = {
  id: string;
  phoneNumber: string;
  nombre: string | null;
  esperandoHumano: boolean;
};

type RelatedOrder = {
  id: string;
  createdAt: string;
  estado: string;
  direccion: string;
  totalLabel: string;
  items: { cantidad: number; nombre: string }[];
};

type StaffChatPanelProps = {
  chatId: string;
  onClose: () => void;
  onUnauthorized?: () => void;
  onConcluded?: () => void;
};

export function StaffChatPanel({ chatId, onClose, onUnauthorized, onConcluded }: StaffChatPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;
  const [chat, setChat] = useState<ChatInfo | null>(null);
  const [orders, setOrders] = useState<RelatedOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  const loadThread = useCallback(async () => {
    const response = await fetch(`/api/staff/chats/${chatId}`, { credentials: "include" });
    if (response.status === 401) {
      unauthorizedRef.current?.();
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "No pudimos cargar la conversación");
    }
    const thread = (await response.json()) as {
      chat: ChatInfo;
      messages: ChatMessage[];
      orders?: RelatedOrder[];
    };
    setChat(thread.chat);
    setMessages(thread.messages ?? []);
    const related = thread.orders ?? [];
    setOrders(related);
    setSelectedOrderId((current) => {
      if (current && related.some((order) => order.id === current)) {
        return current;
      }
      return related[0]?.id ?? null;
    });
  }, [chatId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadThread();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadThread]);

  useEffect(() => {
    void fetch(`/api/staff/chats/${chatId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visto: true }),
    }).catch(() => undefined);
  }, [chatId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadThread().catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadThread]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const mensaje = draft.trim();
    if (!mensaje || sending) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/chats/${chatId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje }),
      });
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos enviar el mensaje");
      }
      setDraft("");
      await loadThread();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  async function handleConclude() {
    const confirmed = window.confirm("¿Seguro que quieres concluir esta conversación?");
    if (!confirmed) {
      return;
    }

    setResolving(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/chats/${chatId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resuelto: true }),
      });
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos concluir la conversación");
      }
      onConcluded?.();
      onClose();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Error al concluir");
    } finally {
      setResolving(false);
    }
  }

  const title = chat?.nombre || chat?.phoneNumber || "Conversación";
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="Cerrar chat"
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-12px_0_40px_rgba(26,26,26,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label="Chat de WhatsApp"
      >
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "#F3F4F6" }}>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{title}</p>
            {chat?.nombre && chat.phoneNumber ? (
              <p className="truncate text-xs text-brand-muted">{chat.phoneNumber}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold"
            style={{ backgroundColor: "#F3F4F6", color: brand.muted }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="border-b px-4 py-3" style={{ borderColor: "#F3F4F6", backgroundColor: "#F8FAF7" }}>
          {orders.length > 1 ? (
            <label className="mb-2 block text-xs font-bold text-brand-muted">
              Pedido
              <select
                value={selectedOrder?.id ?? ""}
                onChange={(event) => setSelectedOrderId(event.target.value)}
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-semibold"
                style={{ borderColor: "#E5E7EB", minHeight: 44 }}
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{formatOrderNumber(order.id)} · {orderStatusLabel(order.estado)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selectedOrder ? (
            <OrderSummary order={selectedOrder} showTitle={orders.length <= 1} />
          ) : (
            <p className="text-sm text-brand-muted">Este cliente no tiene un pedido abierto ahora.</p>
          )}
        </div>

        {error ? (
          <p className="mx-4 mt-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
            {error}
          </p>
        ) : null}

        <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-brand-muted">Todavía no hay mensajes en este chat.</p>
          ) : (
            messages.map((message) => {
              const outgoing = message.direccion === "saliente";
              return (
                <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                    style={
                      outgoing
                        ? { backgroundColor: brand.green, color: "#FFFFFF" }
                        : { backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", color: brand.ink }
                    }
                  >
                    {message.contenido}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="border-t px-4 py-3"
          style={{ borderColor: "#F3F4F6", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribe un mensaje"
            className="w-full rounded-full border px-4 py-3 outline-none"
            style={{ borderColor: "#E5E7EB", fontSize: 16, minHeight: 48 }}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void handleConclude()}
              disabled={resolving || sending}
              className="min-w-0 flex-1 rounded-full px-3 text-sm font-bold disabled:opacity-60"
              style={{ minHeight: 48, backgroundColor: "#F3F4F6", color: brand.ink }}
            >
              {resolving ? "Cerrando..." : "Concluir conversación"}
            </button>
            <button
              type="submit"
              disabled={sending || resolving || draft.trim().length === 0}
              className="shrink-0 rounded-full px-4 text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: brand.orange, minHeight: 48 }}
            >
              {sending ? "..." : "Enviar"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function OrderSummary({ order, showTitle }: { order: RelatedOrder; showTitle: boolean }) {
  const itemLine = order.items.map((item) => `${item.cantidad}× ${item.nombre}`).join(", ");
  return (
    <div>
      {showTitle ? (
        <p className="font-display text-base font-bold">
          #{formatOrderNumber(order.id)}{" "}
          <span className="text-sm font-semibold text-brand-muted">· {orderStatusLabel(order.estado)}</span>
        </p>
      ) : (
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{orderStatusLabel(order.estado)}</p>
      )}
      <p className="mt-1 text-sm leading-snug">{itemLine || "Sin ítems"}</p>
      <p className="mt-1 truncate text-sm text-brand-muted">{order.direccion}</p>
      <p className="mt-1 font-display text-lg font-bold">{order.totalLabel}</p>
    </div>
  );
}
