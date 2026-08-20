"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { createAdminBrowserClient } from "@/lib/admin-browser";
import { ADMIN_NAV, ADMIN_SOON_NAV } from "@/lib/admin-nav";
import { brand } from "@/lib/theme";

type AdminShellProps = {
  email: string;
  children: React.ReactNode;
};

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ email, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

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
          <Link href="/admin/historial" className="px-2" aria-label="Administración Quick!">
            <Logo className="h-9 w-auto max-w-[160px]" />
          </Link>
          <p className="mt-4 px-2 text-[11px] font-bold uppercase tracking-wide text-brand-muted">Admin</p>
          <NavLinks pathname={pathname} />
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
              <Link href="/admin/historial" aria-label="Administración Quick!">
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
                    href={item.href}
                    className="rounded-full px-3 py-1.5 text-sm font-semibold"
                    style={{
                      backgroundColor: active ? brand.green : "#F3F4F6",
                      color: active ? "#FFFFFF" : brand.ink,
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {ADMIN_SOON_NAV.map((label) => (
                <span key={label} className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand-muted/70">
                  {label}
                </span>
              ))}
            </nav>
          </header>
          <main className="px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="mt-2 flex flex-col gap-0.5" aria-label="Administración">
      {ADMIN_NAV.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl px-3 py-2.5 text-sm font-semibold"
            style={{
              backgroundColor: active ? `${brand.green}18` : "transparent",
              color: active ? brand.green : brand.ink,
            }}
          >
            {item.label}
          </Link>
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
