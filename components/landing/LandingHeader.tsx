"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SectionWave } from "@/components/landing/LandingSection";
import { brand } from "@/lib/theme";

const NAV_LINKS = [
  { href: "#quienes-somos", label: "Quiénes somos" },
  { href: "#como-funciona", label: "Cómo comprar" },
  { href: "#catalogo", label: "En el celular" },
  { href: "#donde-estamos", label: "Dónde estamos" },
] as const;

const NAV_LINK_CLASS =
  "text-sm font-bold text-white/95 underline-offset-4 transition hover:text-white hover:underline";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function goTo(href: string) {
    setOpen(false);
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.location.hash = href;
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-shadow duration-300 ${
        scrolled ? "shadow-[0_4px_24px_rgba(26,26,26,0.12)]" : ""
      }`}
    >
      {/* Franja 1 — logo centrado (mobile + desktop) */}
      <div className="flex items-center justify-center bg-white px-6 py-4 md:py-5">
        <a
          href="#inicio"
          aria-label="Quick! Mini Market"
          onClick={(e) => {
            e.preventDefault();
            goTo("#inicio");
          }}
        >
          <Logo className="h-11 w-auto max-w-[200px] md:h-14 md:max-w-[260px]" />
        </a>
      </div>

      {/* Mobile — franja 2: verde + botón naranja (hamburguesa) */}
      <div className="md:hidden">
        <div className="flex h-14">
          <div className="flex-[4]" style={{ backgroundColor: brand.green }} aria-hidden="true" />
          <button
            type="button"
            className="flex flex-1 items-center justify-center"
            style={{ backgroundColor: brand.orange }}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <CloseIcon className="text-white" /> : <MenuIcon className="text-white" />}
          </button>
        </div>

        {open ? (
          <nav
            className="border-t px-6 py-4"
            style={{ borderColor: "#F3F4F6", backgroundColor: "#FFFFFF" }}
            aria-label="Menú móvil"
          >
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
                  href="/empleados"
                  className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-base font-bold text-white"
                  style={{ backgroundColor: brand.orange }}
                  onClick={() => setOpen(false)}
                >
                  Empleados
                </Link>
              </li>
            </ul>
          </nav>
        ) : null}
      </div>

      {/* Desktop — franja 2: nav centrado + Empleados a la derecha */}
      <div className="hidden md:block" style={{ backgroundColor: brand.green }}>
        <div className="relative flex h-14 items-center">
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
            href="/empleados"
            className="ml-auto mr-8 inline-flex min-h-10 items-center justify-center rounded-full px-5 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: brand.orange }}
          >
            Empleados
          </Link>
        </div>
        <SectionWave fill="#FFFFFF" />
      </div>
    </header>
  );
}

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-6 w-6 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-6 w-6 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
