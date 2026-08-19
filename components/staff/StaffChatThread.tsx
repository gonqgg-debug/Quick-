"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffChrome } from "@/components/staff/StaffChrome";
import { StaffLogin, staffLogout } from "@/components/staff/StaffLogin";
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

export function StaffChatThread({ chatId }: { chatId: string }) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [chat, setChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  const loadThread = useCallback(async (): Promise<boolean> => {
    const [threadResponse, listResponse] = await Promise.all([
      fetch(`/api/staff/chats/${chatId}`, { credentials: "include" }),
      fetch("/api/staff/chats", { credentials: "include" }),
    ]);

    if (threadResponse.status === 401 || listResponse.status === 401) {
      setAuthorized(false);
      return false;
    }

    if (!threadResponse.ok) {
      const body = (await threadResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "No pudimos cargar la conversación");
    }

    const thread = (await threadResponse.json()) as { chat: ChatInfo; messages: ChatMessage[] };
    setChat(thread.chat);
    setMessages(thread.messages ?? []);

    if (listResponse.ok) {
      const list = (await listResponse.json()) as { chats: unknown[] };
      setWaitingCount(list.chats?.length ?? 0);
    }

    setAuthorized(true);
    return true;
  }, [chatId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadThread();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
          setAuthorized(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadThread]);

  useEffect(() => {
    if (!authorized) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadThread().catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [authorized, loadThread]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages]);

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
        setAuthorized(false);
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

  async function handleResolve() {
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
        setAuthorized(false);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos marcar como resuelta");
      }
      router.push("/staff/chats");
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Error al resolver");
    } finally {
      setResolving(false);
    }
  }

  if (authorized === null) {
    return (
      <main className="min-h-screen bg-white px-3 pt-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-24 animate-pulse rounded-[28px] bg-gray-100" />
        </div>
      </main>
    );
  }

  if (!authorized) {
    return <StaffLogin onSuccess={() => { loadThread(); }} />;
  }

  const title = chat?.nombre || chat?.phoneNumber || "Conversación";

  return (
    <StaffChrome
      active="chats"
      waitingCount={waitingCount}
      onLogout={() => {
        void staffLogout().then(() => setAuthorized(false));
      }}
    >
      <div className="flex min-h-[70vh] flex-col rounded-[28px] bg-white shadow-[0_10px_28px_rgba(26,26,26,0.08)]">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{title}</p>
            {chat?.nombre && chat.phoneNumber ? (
              <p className="truncate text-xs text-brand-muted">{chat.phoneNumber}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleResolve()}
            disabled={resolving}
            className="shrink-0 rounded-full px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: brand.green, minHeight: 44 }}
          >
            {resolving ? "Cerrando..." : "Marcar como resuelta"}
          </button>
        </div>

        {error ? (
          <p className="mx-3 mb-2 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
            {error}
          </p>
        ) : null}

        <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
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

        <form onSubmit={handleSend} className="flex gap-2 px-3 py-3">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribe un mensaje"
            className="min-w-0 flex-1 rounded-full border px-4 py-3 outline-none"
            style={{ borderColor: "#E5E7EB", fontSize: 16, minHeight: 48 }}
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: brand.orange, minHeight: 48 }}
          >
            {sending ? "..." : "Enviar"}
          </button>
        </form>
      </div>
    </StaffChrome>
  );
}
