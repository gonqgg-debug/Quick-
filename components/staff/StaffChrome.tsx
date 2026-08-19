"use client";

import Link from "next/link";
import { brand } from "@/lib/theme";

type StaffChromeProps = {
  active: "orders" | "chats";
  waitingCount: number;
  onLogout: () => void;
  search?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
};

export function StaffChrome({
  active,
  waitingCount,
  onLogout,
  search,
  filters,
  children,
}: StaffChromeProps) {
  return (
    <div className="min-h-screen bg-white" style={{ color: brand.ink }}>
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
        <header className="border-b px-3 py-2" style={{ borderColor: "#F3F4F6" }}>
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <MiniLogo />
            <div className="min-w-0 flex-1">{search}</div>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: "#F3F4F6", color: brand.muted }}
              aria-label="Salir"
            >
              Salir
            </button>
            <div className="hidden md:block">
              <StaffTabs active={active} waitingCount={waitingCount} />
            </div>
          </div>
        </header>
        {filters ? (
          <div className="border-b bg-white" style={{ borderColor: "#F3F4F6" }}>
            {filters}
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-3xl px-3 pb-28 pt-3 md:pb-8">{children}</div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-2 py-1 backdrop-blur-md md:hidden"
        style={{ borderColor: "#F3F4F6", paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      >
        <StaffTabs active={active} waitingCount={waitingCount} />
      </nav>
    </div>
  );
}

function StaffTabs({
  active,
  waitingCount,
}: {
  active: "orders" | "chats";
  waitingCount: number;
}) {
  return (
    <div className="mx-auto flex max-w-3xl items-center justify-around gap-1 md:justify-end md:gap-2">
      <TabLink href="/staff" active={active === "orders"} icon={<BagIcon />}>
        Pedidos
      </TabLink>
      <TabLink href="/staff/chats" active={active === "chats"} icon={<ChatIcon />} badge={waitingCount}>
        Conversaciones
      </TabLink>
    </div>
  );
}

function TabLink({
  href,
  active,
  icon,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="relative flex min-h-11 min-w-[44px] flex-1 flex-col items-center justify-center rounded-2xl px-3 py-1.5 text-[11px] font-bold md:flex-none md:flex-row md:gap-2 md:text-sm"
      style={{
        color: active ? brand.green : brand.muted,
        backgroundColor: active ? `${brand.green}14` : "transparent",
      }}
    >
      <span className="relative">
        {icon}
        {badge && badge > 0 ? (
          <span
            className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: brand.orange }}
          >
            {badge}
          </span>
        ) : null}
      </span>
      {children}
    </Link>
  );
}

function MiniLogo() {
  return (
    <p className="font-display shrink-0 text-lg font-extrabold leading-none">
      <span style={{ color: brand.green }}>Quick!</span>
    </p>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 7h12l-1 13H7L6 7z" />
      <path d="M9 7V6a3 3 0 0 1 6 0v1" />
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
