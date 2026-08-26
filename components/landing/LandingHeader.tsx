"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/theme";

const NAV_LINKS = [
  { href: "#quienes-somos", label: "Quiénes somos" },
  { href: "#como-funciona", label: "Cómo comprar" },
  { href: "#catalogo", label: "En el celular" },
  { href: "#donde-estamos", label: "Dónde estamos" },
] as const;

const NAV_LINK_CLASS =
  "text-[13px] font-bold uppercase tracking-[0.12em] text-white transition hover:text-white hover:underline underline-offset-4";

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
      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-center bg-white px-6 py-4">
          <a
            href="#inicio"
            aria-label="Quick! Mini Market"
            onClick={(e) => {
              e.preventDefault();
              goTo("#inicio");
            }}
          >
            <Logo className="h-11 w-auto max-w-[200px]" />
          </a>
        </div>

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

      {/* Desktop — naranja escalonado + verde + logo con halo, sin placa */}
      <div className="relative hidden bg-white md:block">
        <div className="h-10 bg-white" aria-hidden="true" />

        <div className="flex items-end">
          <div className="h-10 flex-1 rounded-tr-2xl bg-[#F79521]" />
          <div className="h-16 w-[min(40vw,380px)] shrink-0 rounded-t-3xl bg-[#F79521]" />
          <div className="h-10 flex-1 rounded-tl-2xl bg-[#F79521]" />
        </div>

        <div className="relative flex w-full items-center bg-[#7EB341] py-3">
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
            className="ml-auto mr-8 inline-flex min-h-9 items-center justify-center rounded-full px-5 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: brand.orange }}
          >
            Empleados
          </Link>
        </div>

        <a
          href="#inicio"
          className="absolute left-1/2 top-10 z-30 -translate-x-1/2 -translate-y-1/2"
          aria-label="Quick! Mini Market"
          onClick={(e) => {
            e.preventDefault();
            goTo("#inicio");
          }}
        >
          <Logo className="logo-halo-white h-14 w-auto max-w-[240px]" />
        </a>
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
