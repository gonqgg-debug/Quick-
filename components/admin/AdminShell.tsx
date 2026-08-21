"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { createAdminBrowserClient } from "@/lib/admin-browser";
import { ADMIN_DELIVERY_NAV, ADMIN_HOME, ADMIN_NAV, ADMIN_SOON_NAV } from "@/lib/admin-nav";
import { PRODUCT_REQUESTS_CHANGED_EVENT } from "@/lib/product-requests-shared";
import { brand } from "@/lib/theme";

type AdminShellProps = {
  email: string;
  children: React.ReactNode;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const catalogOpen = pathname.startsWith("/admin/catalogo");
  const [pendingRequests, setPendingRequests] = useState(0);

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

  async function handleLogout() {
    const supabase = createAdminBrowserClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-white" style={{ color: brand.ink }}>
      <div className="flex min-h-screen">
        <aside
          className="hidden w-[232px] shrink-0 flex-col border-r px-3 py-5 md:flex"
          style={{ borderColor: "#F3F4F6", backgroundColor: "#FAFBFA" }}
        >
          <Link href="/admin" className="px-2" aria-label="Administración Quick!">
            <Logo className="h-9 w-auto max-w-[160px]" />
          </Link>
          <p className="mt-4 px-2 text-[11px] font-bold uppercase tracking-wide text-brand-muted">Admin</p>
          <NavLinks pathname={pathname} pendingRequests={pendingRequests} />
          <SoonNav />
          <div className="mt-auto border-t px-2 pt-4" style={{ borderColor: "#E5E7EB" }}>
            <p className="truncate text-xs text-brand-muted">{email}</p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-2 text-sm font-bold"
              style={{ color: brand.ink }}
            >
              Salir
            </button>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="border-b px-4 py-3 md:hidden" style={{ borderColor: "#F3F4F6", backgroundColor: "#FAFBFA" }}>
            <div className="flex items-center justify-between gap-3">
              <Link href="/admin" aria-label="Administración Quick!">
                <Logo className="h-8 w-auto max-w-[140px]" />
              </Link>
              <button type="button" onClick={() => void handleLogout()} className="text-sm font-bold">
                Salir
              </button>
            </div>
            <p className="mt-2 truncate text-xs text-brand-muted">{email}</p>
            <nav className="mt-3 flex flex-wrap gap-1" aria-label="Administración">
              {ADMIN_NAV.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.children?.[0]?.href ?? item.href}
                    className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold"
                    style={{
                      backgroundColor: active ? brand.green : "#F3F4F6",
                      color: active ? "#FFFFFF" : brand.ink,
                    }}
                  >
                    {item.label}
                    {item.href === "/admin/catalogo" ? <PendingBadge count={pendingRequests} /> : null}
                  </Link>
                );
              })}
              {ADMIN_SOON_NAV.map((label) => (
                <span key={label} className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand-muted/70">
                  {label}
                </span>
              ))}
            </nav>
            {catalogOpen ? (
              <nav className="mt-2 flex flex-wrap gap-1" aria-label="Catálogo">
                {(ADMIN_DELIVERY_NAV.find((item) => item.href === "/admin/catalogo")?.children ?? []).map((child) => {
                  const active = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold"
                      style={{
                        backgroundColor: active ? brand.green : "#F3F4F6",
                        color: active ? "#FFFFFF" : brand.ink,
                      }}
                    >
                      {child.label}
                      {child.href === "/admin/catalogo/solicitudes" ? <PendingBadge count={pendingRequests} /> : null}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </header>
          <main className="px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavLinks({ pathname, pendingRequests }: { pathname: string; pendingRequests: number }) {
  const homeActive = isActivePath(pathname, ADMIN_HOME.href);

  return (
    <nav className="mt-2 flex flex-col gap-0.5" aria-label="Administración">
      <Link
        href={ADMIN_HOME.href}
        className="block rounded-xl px-3 py-2.5 text-sm font-semibold"
        style={{
          backgroundColor: homeActive ? `${brand.green}18` : "transparent",
          color: homeActive ? brand.green : brand.ink,
        }}
      >
        {ADMIN_HOME.label}
      </Link>
      <div className="mt-4 px-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Delivery</p>
      </div>
      {ADMIN_DELIVERY_NAV.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <div key={item.href}>
            <Link
              href={item.children?.[0]?.href ?? item.href}
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold"
              style={{
                backgroundColor: active && !item.children ? `${brand.green}18` : "transparent",
                color: active ? brand.green : brand.ink,
              }}
            >
              {item.label}
            </Link>
            {item.children ? (
              <div className="mb-1 ml-2 mt-0.5 flex flex-col gap-0.5 border-l pl-2" style={{ borderColor: "#E5E7EB" }}>
                {item.children.map((child) => {
                  const childActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="inline-flex items-center rounded-lg px-2.5 py-2 text-sm font-semibold"
                      style={{
                        backgroundColor: childActive ? `${brand.green}18` : "transparent",
                        color: childActive ? brand.green : brand.muted,
                      }}
                    >
                      {child.label}
                      {child.href === "/admin/catalogo/solicitudes" ? <PendingBadge count={pendingRequests} /> : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function SoonNav() {
  return (
    <div className="mt-6 px-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Próximamente</p>
      <ul className="mt-2 space-y-1">
        {ADMIN_SOON_NAV.map((label) => (
          <li key={label}>
            <span className="block rounded-xl px-3 py-2 text-sm font-semibold text-brand-muted/70">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
