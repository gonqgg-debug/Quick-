"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CAJA_TABS } from "@/lib/admin-caja-shared";
import { brand } from "@/lib/theme";

export function AdminCajaNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-5 flex flex-wrap gap-1.5" aria-label="Caja">
      {CAJA_TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
            style={{
              backgroundColor: active ? brand.green : "#F3F4F6",
              color: active ? "#FFFFFF" : brand.ink,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
