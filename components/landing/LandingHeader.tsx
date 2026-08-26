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

  const barStyle = scrolled || open
    ? {
        backgroundColor: "rgba(255, 255, 255, 0.88)",
        borderBottomColor: "#F3F4F6",
      }
    : {
        backgroundColor: "transparent",
        borderBottomColor: "transparent",
      };

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open ? "backdrop-blur-md" : ""
      }`}
      style={barStyle}
    >
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-6 md:h-[72px] md:px-8">
        <a
          href="#inicio"
          className="shrink-0"
          aria-label="Quick! Mini Market"
          onClick={(e) => {
            e.preventDefault();
            goTo("#inicio");
          }}
        >
          <Logo className="h-9 w-auto max-w-[150px] md:h-11 md:max-w-[180px]" />
        </a>

        <div className="hidden items-center gap-6 md:flex">
          <nav className="flex items-center gap-8" aria-label="Secciones">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-bold transition-colors hover:opacity-80"
                style={{ color: brand.blue }}
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
            className="inline-flex min-h-10 items-center justify-center rounded-full px-4 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: brand.orange }}
          >
            Empleados
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full md:hidden"
          style={{ color: brand.ink }}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {open ? (
        <nav
          className="border-t px-6 py-4 md:hidden"
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
    </header>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
