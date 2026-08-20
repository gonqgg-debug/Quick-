"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/theme";

type StaffSection = "orders" | "chats";

export type StaffSearchProps = {
  open: boolean;
  query: string;
  placeholder: string;
  onToggle: () => void;
  onChange: (value: string) => void;
};

type StaffChromeProps = {
  active: StaffSection;
  onLogout: () => void;
  wide?: boolean;
  search?: StaffSearchProps;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  filters?: React.ReactNode;
  children: React.ReactNode;
};

const DESKTOP_TABS: { id: StaffSection; href: string; label: string }[] = [
  { id: "orders", href: "/staff", label: "Pedidos" },
  { id: "chats", href: "/staff/chats", label: "Chat" },
];

const MOBILE_TABS: { id: "orders" | "chats"; href: string; label: string }[] = [
  { id: "orders", href: "/staff", label: "Pedidos" },
  { id: "chats", href: "/staff/chats", label: "Chat" },
];

export function StaffChrome({
  active,
  onLogout,
  wide = false,
  search,
  notificationCount = 0,
  onNotificationsClick,
  filters,
  children,
}: StaffChromeProps) {
  const shell = wide ? "mx-auto max-w-6xl px-3" : "mx-auto max-w-3xl px-3";
  const searchOpen = Boolean(search?.open);
  const [pendingCount, setPendingCount] = useState(notificationCount);

  useEffect(() => {
    setPendingCount(notificationCount);
  }, [notificationCount]);

  useEffect(() => {
    let cancelled = false;
    async function loadPending() {
      const response = await fetch("/api/staff/chats", { credentials: "include" });
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { pendingMessageCount?: number };
      if (!cancelled && typeof body.pendingMessageCount === "number") {
        setPendingCount(body.pendingMessageCount);
      }
    }
    void loadPending();
    const timer = window.setInterval(() => {
      void loadPending();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white" style={{ color: brand.ink }}>
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
        <header className="border-b py-3" style={{ borderColor: "#F3F4F6" }}>
          <div className={`flex items-center gap-3 ${shell}`}>
            <MiniLogo />

            {searchOpen && search ? (
              <SearchField search={search} />
            ) : (
              <>
                <nav className="hidden min-w-0 flex-1 overflow-x-auto md:block" aria-label="Secciones">
                  <div className="flex items-center gap-1">
                    {DESKTOP_TABS.map((tab) => {
                      const isActive = active === tab.id;
                      return (
                        <Link
                          key={tab.id}
                          href={tab.href}
                          className="relative flex h-11 shrink-0 items-center px-2.5 text-sm font-semibold"
                          style={{ color: isActive ? brand.green : brand.muted }}
                        >
                          {tab.label}
                          {isActive ? (
                            <span
                              className="absolute inset-x-2 bottom-[6px] h-[2px] rounded-full"
                              style={{ backgroundColor: brand.green }}
                            />
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </nav>
                <div className="min-w-0 flex-1 md:hidden" />
              </>
            )}

            <UtilityIcons
              search={search}
              pendingCount={pendingCount}
              onNotificationsClick={onNotificationsClick}
              onLogout={onLogout}
            />
          </div>
        </header>
        {filters ? (
          <div className={wide ? "border-b bg-white" : "bg-white"} style={wide ? { borderColor: "#F3F4F6" } : undefined}>
            <div className={`${shell} ${wide ? "py-4" : "pt-6 pb-1"}`}>{filters}</div>
          </div>
        ) : null}
      </div>

      <div className={`${shell} pb-28 pt-6 md:pb-8`}>{children}</div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur-md md:hidden"
        style={{ borderColor: "#F3F4F6", paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegación"
      >
        <div className="mx-auto flex max-w-3xl items-stretch">
          {MOBILE_TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-bold"
                style={{ color: isActive ? brand.green : brand.muted }}
              >
                <span className="relative">
                  {tab.id === "orders" ? <OrdersIcon /> : <ChatIcon />}
                  {tab.id === "chats" && pendingCount > 0 ? (
                    <span
                      className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                      style={{ backgroundColor: brand.orange }}
                    >
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function UtilityIcons({
  search,
  pendingCount,
  onNotificationsClick,
  onLogout,
}: {
  search?: StaffSearchProps;
  pendingCount: number;
  onNotificationsClick?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      {search ? (
        <button
          type="button"
          onClick={() => {
            if (search.open) {
              search.onChange("");
            }
            search.onToggle();
          }}
          className="flex h-11 w-9 items-center justify-center"
          style={{ color: search.open ? brand.green : brand.muted }}
          aria-label={search.open ? "Cerrar búsqueda" : "Buscar"}
          aria-pressed={search.open}
        >
          <SearchIcon />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onNotificationsClick}
        className="relative flex h-11 w-9 items-center justify-center"
        style={{ color: brand.muted }}
        aria-label={pendingCount > 0 ? `Notificaciones, ${pendingCount} pendientes` : "Notificaciones"}
      >
        <BellIcon />
        {pendingCount > 0 ? (
          <span
            className="absolute right-0.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: brand.orange }}
          >
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        ) : null}
      </button>
      <AccountMenu onLogout={onLogout} />
    </div>
  );
}

function SearchField({ search }: { search: StaffSearchProps }) {
  return (
    <input
      autoFocus
      value={search.query}
      onChange={(event) => search.onChange(event.target.value)}
      placeholder={search.placeholder}
      className="h-11 min-w-0 flex-1 rounded-full border px-4 outline-none"
      style={{ borderColor: `${brand.green}80`, fontSize: 16 }}
    />
  );
}

function AccountMenu({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-9 items-center justify-center"
        style={{ color: open ? brand.green : brand.muted }}
        aria-label="Cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <PersonIcon />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 min-w-[160px] overflow-hidden rounded-2xl border bg-white py-1 shadow-[0_10px_28px_rgba(26,26,26,0.12)]"
          style={{ borderColor: "#E5E7EB" }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex h-11 w-full items-center px-4 text-left text-sm font-semibold"
            style={{ color: brand.ink }}
          >
            Salir
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MiniLogo() {
  return (
    <Link href="/staff" className="shrink-0" aria-label="Quick! Mini Market">
      <Logo className="h-8 w-auto max-w-[140px] md:h-9 md:max-w-[160px]" />
    </Link>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h12M8 12h12M8 18h12" strokeLinecap="round" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 16.5V7.8A2.8 2.8 0 0 1 7.8 5h8.4A2.8 2.8 0 0 1 19 7.8v5.4A2.8 2.8 0 0 1 16.2 16H9l-4 3.5z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.2-3.2 3.5-4.8 6.5-4.8s5.3 1.6 6.5 4.8" strokeLinecap="round" />
    </svg>
  );
}
