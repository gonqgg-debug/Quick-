"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffChrome } from "@/components/staff/StaffChrome";
import { StaffLogin, staffLogout } from "@/components/staff/StaffLogin";
import { brand } from "@/lib/theme";
import { formatWaitingSince } from "@/lib/time";

type WaitingChat = {
  id: string;
  phoneNumber: string;
  nombre: string | null;
  esperandoHumanoDesde: string | null;
};

export function StaffChatsList() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [chats, setChats] = useState<WaitingChat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void loadChats().catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [authorized, loadChats]);

  const visibleChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return chats;
    }
    return chats.filter((chat) =>
      [chat.nombre ?? "", chat.phoneNumber].join(" ").toLowerCase().includes(query)
    );
  }, [chats, searchQuery]);

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

  return (
    <StaffChrome
      active="chats"
      waitingCount={chats.length}
      onLogout={() => {
        void staffLogout().then(() => {
          setAuthorized(false);
          setChats([]);
        });
      }}
      search={
        searchOpen ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar cliente o teléfono"
              className="h-11 w-full rounded-full border px-4 outline-none"
              style={{ borderColor: `${brand.green}80`, fontSize: 16 }}
            />
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchOpen(false);
              }}
              className="h-11 text-sm font-bold"
              style={{ color: brand.blue }}
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: "#F3F4F6" }}
              aria-label="Buscar"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={brand.ink} strokeWidth="2.2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )
      }
    >
      {error ? (
        <p className="mb-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {visibleChats.length === 0 ? (
        <div className="rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="text-4xl">🎉</p>
          <p className="font-display mt-3 text-xl font-bold">No hay conversaciones pendientes 🎉</p>
          <p className="mt-2 text-sm text-brand-muted">Cuando un cliente pida hablar con alguien, aparece aquí.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleChats.map((chat) => (
            <li key={chat.id}>
              <Link
                href={`/staff/chats/${chat.id}`}
                className="flex items-center justify-between gap-3 rounded-[28px] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(26,26,26,0.08)]"
                style={{ minHeight: 72, borderLeft: `6px solid ${brand.orange}` }}
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold">{chat.nombre || chat.phoneNumber}</p>
                  {chat.nombre ? <p className="truncate text-sm text-brand-muted">{chat.phoneNumber}</p> : null}
                </div>
                <p className="shrink-0 text-sm font-bold" style={{ color: brand.orange }}>
                  {formatWaitingSince(chat.esperandoHumanoDesde, now)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StaffChrome>
  );
}
