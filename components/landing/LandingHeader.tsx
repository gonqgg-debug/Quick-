"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/theme";

const NAV_LINKS = [
  { href: "/quienes-somos", label: "Quiénes somos" },
  { href: "/expansion", label: "Expansión" },
  { href: "/#donde-estamos", label: "Dónde estamos" },
] as const;

const NAV_LINK_CLASS =
  "text-[13px] font-bold uppercase tracking-[0.12em] text-white transition hover:text-white hover:underline underline-offset-4";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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
    if (href.startsWith("/#") || href.startsWith("#")) {
      const id = href.replace(/^\/?#/, "");
      if (pathname === "/") {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
      window.location.href = `/#${id}`;
      return;
    }
    router.push(href);
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-shadow duration-300 ${
        scrolled ? "shadow-[0_4px_24px_rgba(26,26,26,0.12)]" : ""
      }`}
    >
      <div className="md:hidden">
        <div className="flex h-14 overflow-hidden rounded-t-3xl">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center justify-start bg-[#F79521] px-4"
            aria-label="Quick! Mini Market"
            onClick={() => setOpen(false)}
          >
            <Logo variant="contour" className="h-10 w-auto max-w-[180px]" />
          </Link>
          <button
            type="button"
            className="flex h-full w-14 shrink-0 items-center justify-center bg-[#7EB341]"
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

      <div className="hidden md:block">
        <div className="flex items-center justify-center bg-[#F79521] py-3">
          <Link href="/" aria-label="Quick! Mini Market">
            <Logo variant="contour" className="h-14 w-auto max-w-[240px]" />
          </Link>
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
