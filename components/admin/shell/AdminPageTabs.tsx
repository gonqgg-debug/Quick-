"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/theme";

export type AdminPageTab = {
  href: string;
  label: string;
};

export function AdminPageTabs({ label, tabs }: { label: string; tabs: readonly AdminPageTab[] }) {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex flex-wrap gap-1.5" aria-label={label}>
      {tabs.map((tab) => {
        const active = isTabActive(pathname, tab.href, tabs);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
            style={{
              backgroundColor: active ? brand.green : "#F3F4F6",
              color: active ? "#FFFFFF" : brand.ink,
            }}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminPosLink() {
  return (
    <Link
      href="/pos"
      className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold text-white"
      style={{ backgroundColor: brand.green }}
    >
      Abrir caja POS
    </Link>
  );
}

function isTabActive(pathname: string, href: string, tabs: readonly AdminPageTab[]): boolean {
  if (pathname === href) {
    return true;
  }
  const coveredByChild = tabs.some(
    (tab) => tab.href !== href && tab.href.startsWith(`${href}/`) && (pathname === tab.href || pathname.startsWith(`${tab.href}/`))
  );
  if (coveredByChild) {
    return false;
  }
  return pathname.startsWith(`${href}/`);
}
