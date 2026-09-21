import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { BrandButton } from "@/components/landing/BrandUi";
import { brand, whatsappHref } from "@/lib/theme";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="px-6 pb-12 pt-14 md:px-8" style={{ backgroundColor: brand.ink }}>
      <div className="mx-auto max-w-[1100px]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-start gap-4">
            <Logo variant="contour" className="h-12 max-w-[180px]" />
            <BrandButton href={whatsappHref()} variant="green" size="sm">
              Pedir por WhatsApp
            </BrandButton>
            <BrandButton href="/empleados" variant="orange" size="sm" uppercase>
              Empleados
            </BrandButton>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Dónde estamos</p>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Dentro de residenciales del área de Bávaro y Verón, La Altagracia, República Dominicana
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/85">Todos los días, 8:00 a. m. – 12:00 a. m.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Explora</p>
            <div className="mt-3 grid gap-2 text-sm">
              <Link href="/quienes-somos" className="text-white/85 hover:text-white">
                Quiénes somos
              </Link>
              <Link href="/expansion" className="text-white/85 hover:text-white">
                Expansión
              </Link>
              <Link href="/pharmaquick" className="hover:opacity-90" style={{ color: "#4FA3DB" }}>
                PharmaQuick!
              </Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Contacto</p>
            <div className="mt-3 grid gap-2 text-sm">
              <a href="tel:+13056083660" className="text-white/85 hover:text-white">
                +1 305 608 3660
              </a>
              <a href={whatsappHref()} className="hover:opacity-90" style={{ color: brand.green }}>
                WhatsApp
              </a>
            </div>
          </div>
        </div>
        <p className="mt-10 text-center text-sm text-white/40">© {year} Quick! Mini Market</p>
      </div>
    </footer>
  );
}
