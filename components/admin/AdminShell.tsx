"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { createAdminBrowserClient } from "@/lib/admin-browser";
import {
  ADMIN_HOME,
  ADMIN_NAV_SECTIONS,
  type AdminNavChild,
  type AdminNavIcon,
  type AdminNavItem,
  type AdminNavSectionId,
} from "@/lib/admin-nav";
import { PRODUCT_REQUESTS_CHANGED_EVENT } from "@/lib/product-requests-shared";
import { brand } from "@/lib/theme";

type AdminShellProps = {
  email: string;
  children: React.ReactNode;
};

type OpenState = Record<AdminNavSectionId | "caja", boolean>;

const NAV_STORAGE_KEY = "quick-admin-nav-open";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/admin/ventas") {
    return pathname === href;
  }
  if (href === "/admin/clientes") {
    if (pathname.startsWith("/admin/clientes/mensajes-masivos")) {
      return false;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionForPath(pathname: string): AdminNavSectionId | null {
  if (pathname.startsWith("/admin/historial") || pathname.startsWith("/admin/pedidos")) {
    return "pedidos";
  }
  if (pathname.startsWith("/admin/clientes")) {
    return "clientes";
  }
  if (pathname.startsWith("/admin/catalogo")) {
    return "catalogo";
  }
  if (
    pathname.startsWith("/admin/ventas") ||
    pathname.startsWith("/admin/compras") ||
    pathname.startsWith("/admin/proveedores") ||
    pathname.startsWith("/admin/parametros") ||
    pathname.startsWith("/admin/caja")
  ) {
    return "finanzas";
  }
  return null;
}

function defaultOpen(): OpenState {
  return {
    pedidos: true,
    clientes: true,
    catalogo: true,
    finanzas: true,
    caja: true,
  };
}

function readSavedOpen(): Partial<OpenState> | null {
  try {
    const raw = window.localStorage.getItem(NAV_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<OpenState>) : null;
  } catch {
    return null;
  }
}

function persistOpen(next: OpenState) {
  try {
    window.localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }
  return (
    <span
      className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
      style={{ backgroundColor: brand.orange }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function AdminShell({ email, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [open, setOpen] = useState<OpenState>(() => defaultOpen());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPending() {
      const response = await fetch("/api/admin/catalogo/solicitudes?countOnly=1", { credentials: "include" });
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { pendingCount?: number };
      if (!cancelled && typeof body.pendingCount === "number") {
        setPendingRequests(body.pendingCount);
      }
    }
    void loadPending();
    const timer = window.setInterval(() => {
      void loadPending();
    }, 20000);
    window.addEventListener(PRODUCT_REQUESTS_CHANGED_EVENT, loadPending);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(PRODUCT_REQUESTS_CHANGED_EVENT, loadPending);
    };
  }, []);

  useEffect(() => {
    const saved = readSavedOpen();
    setOpen((prev) => {
      const next = { ...prev, ...saved };
      const section = sectionForPath(pathname);
      if (section) {
        next[section] = true;
      }
      if (pathname.startsWith("/admin/caja")) {
        next.caja = true;
      }
      return next;
    });
    // Restore collapsed sections once; later navigations only expand the active group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setOpen((prev) => {
      const section = sectionForPath(pathname);
      const needsCaja = pathname.startsWith("/admin/caja") && !prev.caja;
      if ((!section || prev[section]) && !needsCaja) {
        return prev;
      }
      const next = { ...prev };
      if (section) {
        next[section] = true;
      }
      if (pathname.startsWith("/admin/caja")) {
        next.caja = true;
      }
      persistOpen(next);
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    function onViewportChange() {
      if (media.matches) {
        setMenuOpen(false);
      }
    }
    onViewportChange();
    media.addEventListener("change", onViewportChange);
    return () => media.removeEventListener("change", onViewportChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function toggleOpen(key: keyof OpenState) {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      persistOpen(next);
      return next;
    });
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleLogout() {
    const supabase = createAdminBrowserClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const sidebarProps = {
    pathname,
    pendingRequests,
    open,
    onToggle: toggleOpen,
    email,
    onLogout: () => void handleLogout(),
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white" style={{ color: brand.ink }}>
      <div className="flex min-h-screen">
        <AdminSidebar
          className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r px-3 py-4 md:flex"
          style={{ borderColor: "#EEF1EE", backgroundColor: "#F7F8F6" }}
          {...sidebarProps}
        />
        <div className="min-w-0 flex-1">
          <header
            className="sticky top-0 z-30 border-b bg-white px-4 py-2.5 md:hidden"
            style={{ borderColor: "#EEF1EE" }}
          >
            <div className="flex items-center justify-between gap-3">
              <Link href="/admin" aria-label="Administración Quick!">
                <Logo className="h-7 w-auto max-w-[120px]" />
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-brand-ink transition-colors hover:bg-black/[0.05]"
                aria-label="Abrir menú"
                aria-expanded={menuOpen}
                aria-controls="admin-mobile-nav"
              >
                <MenuGlyph />
              </button>
            </div>
          </header>
          <main className="px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 md:hidden ${menuOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          tabIndex={menuOpen ? 0 : -1}
          aria-label="Cerrar menú"
          onClick={closeMenu}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <AdminSidebar
          {...sidebarProps}
          id="admin-mobile-nav"
          role="dialog"
          ariaModal
          ariaLabel="Menú de administración"
          className={`absolute inset-y-0 left-0 z-10 flex w-[85%] max-w-[320px] flex-col border-r px-3 py-4 shadow-xl transition-transform duration-200 ease-out ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ borderColor: "#EEF1EE", backgroundColor: "#F7F8F6" }}
          headerAction={
            <button
              type="button"
              onClick={closeMenu}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-ink transition-colors hover:bg-black/[0.05]"
              aria-label="Cerrar menú"
              tabIndex={menuOpen ? 0 : -1}
            >
              <CloseGlyph />
            </button>
          }
          onNavigate={closeMenu}
          inert={!menuOpen}
        />
      </div>
    </div>
  );
}

function AdminSidebar({
  id,
  role,
  ariaModal,
  ariaLabel,
  className,
  style,
  pathname,
  pendingRequests,
  open,
  onToggle,
  email,
  onLogout,
  onNavigate,
  headerAction,
  inert,
}: {
  id?: string;
  role?: string;
  ariaModal?: boolean;
  ariaLabel?: string;
  className: string;
  style?: React.CSSProperties;
  pathname: string;
  pendingRequests: number;
  open: OpenState;
  onToggle: (key: keyof OpenState) => void;
  email: string;
  onLogout: () => void;
  onNavigate?: () => void;
  headerAction?: React.ReactNode;
  inert?: boolean;
}) {
  const initial = email.trim().charAt(0).toUpperCase() || "A";
  return (
    <aside
      id={id}
      role={role}
      aria-modal={ariaModal || undefined}
      aria-label={ariaLabel}
      className={className}
      style={style}
      inert={inert || undefined}
    >
      <div className="flex items-center justify-between gap-2 px-2">
        <Link
          href="/admin"
          className="rounded-xl py-1"
          aria-label="Administración Quick!"
          onClick={onNavigate}
        >
          <Logo className="h-9 w-auto max-w-[160px]" />
        </Link>
        {headerAction}
      </div>
      <AdminNav
        idPrefix={id}
        pathname={pathname}
        pendingRequests={pendingRequests}
        open={open}
        onToggle={onToggle}
        onNavigate={onNavigate}
      />
      <div className="mt-auto border-t px-1 pt-3" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex items-center gap-2.5 px-2 py-1">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: brand.green }}
          >
            {initial}
          </span>
          <p className="min-w-0 truncate text-xs text-brand-muted">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onLogout();
          }}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-black/[0.05]"
        >
          <NavGlyph name="logout" />
          Salir
        </button>
      </div>
    </aside>
  );
}

function AdminNav({
  idPrefix,
  pathname,
  pendingRequests,
  open,
  onToggle,
  onNavigate,
}: {
  idPrefix?: string;
  pathname: string;
  pendingRequests: number;
  open: OpenState;
  onToggle: (key: keyof OpenState) => void;
  onNavigate?: () => void;
}) {
  return (
    <nav className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-4" aria-label="Administración">
      <LiveItem item={ADMIN_HOME} pathname={pathname} pendingRequests={pendingRequests} onNavigate={onNavigate} />
      {ADMIN_NAV_SECTIONS.map((section) => {
        const expanded = open[section.id];
        const hasActive = section.items.some((item) => isActivePath(pathname, item.href));
        const sectionDomId = idPrefix ? `${idPrefix}-section-${section.id}` : `nav-section-${section.id}`;
        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => onToggle(section.id)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-muted transition-colors hover:bg-black/[0.04] hover:text-brand-ink"
              aria-expanded={expanded}
              aria-controls={sectionDomId}
            >
              <span className="flex items-center gap-2">
                {section.label}
                {!expanded && hasActive ? (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brand.green }} />
                ) : null}
              </span>
              <Chevron open={expanded} />
            </button>
            <Collapse open={expanded}>
              <div id={sectionDomId} className="mt-0.5 flex flex-col gap-0.5">
                {section.items.map((item) =>
                  item.status === "slot" ? (
                    <SoonItem key={item.label} item={item} />
                  ) : (
                    <LiveItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      pendingRequests={pendingRequests}
                      nestedOpen={item.href === "/admin/caja" ? open.caja : false}
                      onToggleNested={item.href === "/admin/caja" ? () => onToggle("caja") : undefined}
                      onNavigate={onNavigate}
                    />
                  ),
                )}
              </div>
            </Collapse>
          </div>
        );
      })}
    </nav>
  );
}

function LiveItem({
  item,
  pathname,
  pendingRequests,
  nestedOpen = false,
  onToggleNested,
  onNavigate,
}: {
  item: AdminNavItem;
  pathname: string;
  pendingRequests: number;
  nestedOpen?: boolean;
  onToggleNested?: () => void;
  onNavigate?: () => void;
}) {
  const active = isActivePath(pathname, item.href);
  const hasChildren = Boolean(item.children?.length);
  const childrenOpen = hasChildren ? nestedOpen : false;

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <Link
          href={item.children?.[0]?.href ?? item.href}
          onClick={onNavigate}
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors ${
            active && !hasChildren ? "" : "hover:bg-black/[0.04]"
          }`}
          style={{
            backgroundColor: active && !hasChildren ? `${brand.green}1F` : "transparent",
            color: active ? brand.green : brand.ink,
          }}
        >
          <NavGlyph name={item.icon} />
          <span className="truncate">{item.label}</span>
          {item.href === "/admin/catalogo/solicitudes" ? <PendingBadge count={pendingRequests} /> : null}
        </Link>
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggleNested}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-muted transition-colors hover:bg-black/[0.04] hover:text-brand-ink"
            aria-expanded={childrenOpen}
            aria-label={childrenOpen ? `Cerrar ${item.label}` : `Abrir ${item.label}`}
          >
            <Chevron open={childrenOpen} />
          </button>
        ) : null}
      </div>
      {hasChildren ? (
        <Collapse open={childrenOpen}>
          <div className="mb-1 ml-4 mt-0.5 flex flex-col gap-0.5 border-l pl-2" style={{ borderColor: "#D9DDD6" }}>
            {item.children?.map((child) => (
              <ChildLink
                key={child.href}
                child={child}
                pathname={pathname}
                pendingRequests={pendingRequests}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </Collapse>
      ) : null}
    </div>
  );
}

function ChildLink({
  child,
  pathname,
  pendingRequests,
  onNavigate,
}: {
  child: AdminNavChild;
  pathname: string;
  pendingRequests: number;
  onNavigate?: () => void;
}) {
  const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
  return (
    <Link
      href={child.href}
      onClick={onNavigate}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
        childActive ? "" : "hover:bg-black/[0.04]"
      }`}
      style={{
        backgroundColor: childActive ? `${brand.green}1F` : "transparent",
        color: childActive ? brand.green : brand.muted,
      }}
    >
      <NavGlyph name={child.icon} className="h-3.5 w-3.5 shrink-0" />
      <span>{child.label}</span>
      {child.href === "/admin/catalogo/solicitudes" ? <PendingBadge count={pendingRequests} /> : null}
    </Link>
  );
}

function SoonItem({ item }: { item: AdminNavItem }) {
  return (
    <span className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-brand-muted/55">
      <NavGlyph name={item.icon} />
      <span className="truncate">{item.label}</span>
    </span>
  );
}

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MenuGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function NavGlyph({
  name,
  className = "h-[18px] w-[18px] shrink-0",
}: {
  name: AdminNavIcon | "logout";
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="m3 10.5 9-7.5 9 7.5" />
          <path d="M5 9.8V21h14V9.8" />
          <path d="M10 21v-7h4v7" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 1.5" />
          <path d="M9 3.5 7 6H3" />
        </svg>
      );
    case "catalog":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.2" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" />
          <rect x="3" y="14" width="7" height="7" rx="1.2" />
          <rect x="14" y="14" width="7" height="7" rx="1.2" />
        </svg>
      );
    case "products":
      return (
        <svg {...common}>
          <path d="M16.5 9.4 7.5 4.9" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.3 7 12 12l8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "import":
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m8 8 4-4 4 4" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      );
    case "images":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m21 16-5-4-4 3-2-1.5-7 5.5" />
        </svg>
      );
    case "requests":
      return (
        <svg {...common}>
          <path d="M22 12H6" />
          <path d="m16 6 6 6-6 6" />
          <path d="M2 6v12" />
        </svg>
      );
    case "purchases":
      return (
        <svg {...common}>
          <path d="M6 7h15l-1.5 9h-12z" />
          <path d="M6 7 5 3H2" />
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
        </svg>
      );
    case "suppliers":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3.2" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a3.2 3.2 0 0 1 0 6.26" />
        </svg>
      );
    case "customers":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20v-1.4A4.6 4.6 0 0 1 7.6 14h2.8A4.6 4.6 0 0 1 15 18.6V20" />
          <circle cx="17" cy="8" r="2.4" />
          <path d="M21.5 20v-1.2A3.8 3.8 0 0 0 18 15h-.4" />
        </svg>
      );
    case "broadcast":
      return (
        <svg {...common}>
          <path d="M4 10v4" />
          <path d="M7 8v8" />
          <path d="m10 5 9 3.5v7L10 19z" />
          <path d="M10 8.5v7" />
        </svg>
      );
    case "sales":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-4" />
          <path d="M12 16V8" />
          <path d="M16 16v-7" />
        </svg>
      );
    case "cash":
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.4" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    case "pnl":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m8 14 4-4 3 3 5-6" />
        </svg>
      );
    case "goals":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M4 17h16" />
          <circle cx="9" cy="7" r="2.2" />
          <circle cx="15" cy="17" r="2.2" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
  }
}
