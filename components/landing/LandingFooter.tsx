import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LandingInner } from "@/components/landing/LandingSection";
import { brand, whatsappHref } from "@/lib/theme";

function IconMessageCircle({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="pb-12 pt-10 md:pt-14" style={{ backgroundColor: brand.ink }}>
      <LandingInner>
        <div className="grid gap-10 text-center md:grid-cols-3 md:gap-8 md:text-left">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <Logo variant="contour" className="h-12 max-w-[180px]" />
            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: brand.green }}
            >
              <IconMessageCircle className="h-4 w-4" />
              Pedir por WhatsApp
            </a>
            <Link
              href="/empleados"
              className="inline-flex min-h-10 items-center justify-center rounded-full px-5 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: brand.orange }}
            >
              Empleados
            </Link>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Dónde estamos</p>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Residencial Jardines 3, Pueblo Bávaro, La Altagracia, República Dominicana
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">En el mapa</p>
            <p className="mt-3 text-sm font-semibold text-white">Residencial Jardines 3</p>
            <p className="text-sm text-white/70">Pueblo Bávaro</p>
          </div>
        </div>
        <p className="mt-10 text-center text-sm text-white/40">© {year} Quick! Mini Market</p>
      </LandingInner>
    </footer>
  );
}
