"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/theme";

const NAV_LINKS = [
  { href: "#muy-pronto", label: "Muy pronto" },
  { href: "#donde-estamos", label: "Dónde estamos" },
] as const;

const NAV_LINK_CLASS =
  "text-[13px] font-bold uppercase tracking-[0.12em] text-white transition hover:underline underline-offset-4";

export function PharmaHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function goTo(href: string) {
    setOpen(false);
    if (href.startsWith("#")) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <header className="sticky top-0 z-50">
      <div className="md:hidden">
        <div className="flex h-14 overflow-hidden">
          <Link
            href="/pharmaquick"
            className="flex min-w-0 flex-1 items-center bg-white px-4"
            aria-label="PharmaQuick!"
            onClick={() => setOpen(false)}
          >
            <Logo variant="pharma" className="h-8 w-auto max-w-[220px]" />
          </Link>
          <button
            type="button"
            className="flex h-full w-14 shrink-0 items-center justify-center bg-[#1F82C5]"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <CloseIcon className="text-white" /> : <MenuIcon className="text-white" />}
          </button>
        </div>
        {open ? (
          <nav className="border-t bg-white px-6 py-4" aria-label="Menú móvil">
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="flex min-h-12 items-center text-base font-bold"
                    style={{ color: brand.blue }}
                    onClick={(e) => {
                      e.preventDefault();
                      goTo(link.href);
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/"
                  className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-base font-bold text-white"
                  style={{ backgroundColor: brand.blue }}
                  onClick={() => setOpen(false)}
                >
                  Volver a Quick!
                </Link>
              </li>
            </ul>
          </nav>
        ) : null}
      </div>

      <div className="hidden md:block">
        <div className="flex items-center justify-center bg-white py-3">
          <Link href="/pharmaquick" aria-label="PharmaQuick!">
            <Logo variant="pharma" className="h-12 w-auto max-w-[320px]" />
          </Link>
        </div>
        <div className="relative flex w-full items-center bg-[#1F82C5] py-3">
          <nav
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-8"
            aria-label="Secciones"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={NAV_LINK_CLASS}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(link.href);
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <Link
            href="/"
            className="ml-auto mr-8 text-[13px] font-bold uppercase tracking-[0.12em] text-white underline-offset-4 hover:underline"
          >
            Volver a Quick!
          </Link>
        </div>
      </div>
    </header>
  );
}

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
