"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffChatPanel } from "@/components/staff/StaffChatPanel";
import { StaffChrome } from "@/components/staff/StaffChrome";
import { StaffLogin, staffLogout } from "@/components/staff/StaffLogin";
import {
  elapsedMinutes,
  formatElapsedClock,
  ORDER_AGING,
  orderAgingColor,
  orderAgingLevel,
  usesOrderAging,
} from "@/lib/order-aging";
import { brand } from "@/lib/theme";
import { formatElapsedAgo } from "@/lib/time";
import type { OrderEstado } from "@/lib/types";

type ChatOrder = {
  id: string;
  direccion: string;
  createdAt: string;
  estado: OrderEstado;
};

type WaitingChat = {
  id: string;
  phoneNumber: string;
  nombre: string | null;
  esperandoHumano: boolean;
  esperandoHumanoDesde: string | null;
  lastMessageAt: string | null;
  lastMessage: string | null;
  order: ChatOrder | null;
};

function urgencyTimestamp(chat: WaitingChat): number {
  if (chat.order && usesOrderAging(chat.order.estado)) {
    const ts = new Date(chat.order.createdAt).getTime();
    return Number.isNaN(ts) ? Date.now() : ts;
  }
  const fallback = chat.esperandoHumanoDesde || chat.lastMessageAt;
  if (!fallback) {
    return Date.now();
  }
  const ts = new Date(fallback).getTime();
  return Number.isNaN(ts) ? Date.now() : ts;
}

function lastActivityTimestamp(chat: WaitingChat): number {
  const iso = chat.lastMessageAt || chat.esperandoHumanoDesde;
  if (!iso) {
    return 0;
  }
  const ts = new Date(iso).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export function StaffChatsList({ initialChatId = null }: { initialChatId?: string | null }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [chats, setChats] = useState<WaitingChat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openChatId, setOpenChatId] = useState<string | null>(initialChatId);
  const [closedExpanded, setClosedExpanded] = useState(false);
  const [closedTouched, setClosedTouched] = useState(false);

  const loadChats = useCallback(async (): Promise<boolean> => {
    const response = await fetch("/api/staff/chats", { credentials: "include" });
    if (response.status === 401) {
      setAuthorized(false);
      setChats([]);
      return false;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "No pudimos cargar las conversaciones");
    }
    const body = (await response.json()) as { chats: WaitingChat[] };
    setChats(body.chats ?? []);
    setAuthorized(true);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadChats();
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
  }, [loadChats]);

  useEffect(() => {
    if (!authorized) {
      return;
    }
    const tick = window.setInterval(() => {
      setNow(Date.now());
    }, ORDER_AGING.tickMs);
    const refresh = window.setInterval(() => {
      void loadChats().catch(() => undefined);
    }, 10000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [authorized, loadChats]);

  const visibleChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? chats.filter((chat) =>
          [chat.nombre ?? "", chat.phoneNumber, chat.order?.direccion ?? "", chat.lastMessage ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : chats;

    const open = filtered
      .filter((chat) => chat.esperandoHumano)
      .sort((a, b) => urgencyTimestamp(a) - urgencyTimestamp(b));
    const closed = filtered
      .filter((chat) => !chat.esperandoHumano)
      .sort((a, b) => lastActivityTimestamp(b) - lastActivityTimestamp(a));
    return { open, closed };
  }, [chats, searchQuery]);

  const searching = searchQuery.trim().length > 0;
  const showClosed = searching || (closedTouched ? closedExpanded : visibleChats.open.length === 0);

  if (authorized === null) {
    return (
      <main className="min-h-screen bg-white px-3 pt-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="h-20 animate-pulse rounded-[28px] bg-gray-100" />
          <div className="h-20 animate-pulse rounded-[28px] bg-gray-100" />
        </div>
      </main>
    );
  }

  if (!authorized) {
    return <StaffLogin onSuccess={() => { loadChats(); }} />;
  }

  const hasAny = visibleChats.open.length > 0 || visibleChats.closed.length > 0;

  return (
    <StaffChrome
      active="chats"
      onLogout={() => {
        void staffLogout().then(() => {
          setAuthorized(false);
          setChats([]);
        });
      }}
      search={{
        open: searchOpen,
        query: searchQuery,
        placeholder: "Buscar cliente, teléfono o dirección",
        onToggle: () => setSearchOpen((current) => !current),
        onChange: setSearchQuery,
      }}
    >
      {error ? (
        <p className="mb-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {!hasAny ? (
        <div className="rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="text-4xl">🎉</p>
          <p className="font-display mt-3 text-xl font-bold">No hay conversaciones pendientes 🎉</p>
          <p className="mt-2 text-sm text-brand-muted">Cuando un cliente pida hablar con alguien, aparece aquí.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {visibleChats.open.length === 0 ? (
            <p className="px-1 text-sm text-brand-muted">No hay conversaciones abiertas ahora.</p>
          ) : (
            <ul className="space-y-3">
              {visibleChats.open.map((chat) => (
                <li key={chat.id}>
                  <ChatRow chat={chat} now={now} onOpen={() => setOpenChatId(chat.id)} />
                </li>
              ))}
            </ul>
          )}

          {visibleChats.closed.length > 0 ? (
            <section>
              <button
                type="button"
                onClick={() => {
                  setClosedTouched(true);
                  setClosedExpanded(!showClosed);
                }}
                className="mb-3 flex w-full items-center justify-between px-1 text-left"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Cerradas ({visibleChats.closed.length})
                </span>
                <span className="text-sm text-brand-muted">{showClosed ? "Ocultar" : "Ver"}</span>
              </button>
              {showClosed ? (
                <ul className="space-y-3">
                  {visibleChats.closed.map((chat) => (
                    <li key={chat.id}>
                      <ChatRow chat={chat} now={now} onOpen={() => setOpenChatId(chat.id)} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
      {openChatId ? (
        <StaffChatPanel
          chatId={openChatId}
          onClose={() => setOpenChatId(null)}
          onUnauthorized={() => setAuthorized(false)}
          onConcluded={() => {
            void loadChats().catch(() => undefined);
          }}
        />
      ) : null}
    </StaffChrome>
  );
}

function ChatRow({
  chat,
  now,
  onOpen,
}: {
  chat: WaitingChat;
  now: number;
  onOpen: () => void;
}) {
  const title = chat.nombre || chat.phoneNumber;
  const aging = chat.order && usesOrderAging(chat.order.estado);
  const agingLevel = aging && chat.order ? orderAgingLevel(elapsedMinutes(chat.order.createdAt, now)) : null;
  const stripe = agingLevel
    ? orderAgingColor(agingLevel)
    : chat.esperandoHumano
      ? brand.orange
      : "#E5E7EB";
  const lastAt = chat.lastMessageAt || chat.esperandoHumanoDesde;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start justify-between gap-3 rounded-[28px] bg-white px-4 py-4 text-left shadow-[0_10px_28px_rgba(26,26,26,0.08)]"
      style={{ minHeight: 72, borderLeft: `6px solid ${stripe}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 truncate font-display text-lg font-bold">{title}</p>
          {chat.esperandoHumano ? (
            <span
              className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
              style={{ backgroundColor: brand.orange }}
            >
              Abierta
            </span>
          ) : null}
        </div>
        {chat.nombre && !chat.order ? (
          <p className="truncate text-sm text-brand-muted">{chat.phoneNumber}</p>
        ) : null}
        {chat.order?.direccion ? (
          <p className="mt-0.5 truncate text-sm text-brand-muted">{chat.order.direccion}</p>
        ) : null}
        {!chat.order && chat.lastMessage ? (
          <p className="mt-1 truncate text-sm text-brand-muted">{chat.lastMessage}</p>
        ) : null}
        <p className="mt-1 text-xs text-brand-muted">{formatElapsedAgo(lastAt, now)}</p>
      </div>
      {aging && chat.order && agingLevel ? (
        <div className="shrink-0 pt-0.5 text-right">
          <p
            className="font-mono text-lg font-bold tabular-nums leading-none tracking-tight"
            style={{ color: orderAgingColor(agingLevel), minWidth: "6ch" }}
          >
            {formatElapsedClock(chat.order.createdAt, now)}
            {agingLevel === "urgent" ? " ⚠️" : ""}
          </p>
        </div>
      ) : null}
    </button>
  );
}
