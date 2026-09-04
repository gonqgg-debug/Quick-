"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function PharmaHeader() {
  return (
    <header className="sticky top-0 z-50">
      <div className="flex h-14 items-center justify-between bg-[#1F82C5] px-4 md:h-auto md:px-8 md:py-3">
        <Link href="/pharmaquick" aria-label="PharmaQuick!">
          <Logo variant="pharma" onDark className="h-8 w-auto max-w-[200px] md:h-12 md:max-w-[260px]" />
        </Link>
        <Link
          href="/"
          className="text-[13px] font-bold uppercase tracking-[0.12em] text-white underline-offset-4 hover:underline"
        >
          Volver a Quick!
        </Link>
      </div>
    </header>
  );
}
