import fs from "fs";
import path from "path";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LandingBuyHowYouWant } from "@/components/landing/LandingBuyHowYouWant";
import { LandingCatalogPreview } from "@/components/landing/LandingCatalogPreview";
import { LandingDifferentiators } from "@/components/landing/LandingDifferentiators";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { QuickCoinsBanner } from "@/components/landing/QuickCoinsBanner";
import { LandingInner, SectionWave, SoftCircles } from "@/components/landing/LandingSection";
import { WhatsAppFloat } from "@/components/landing/WhatsAppFloat";
import { brand, whatsappHref } from "@/lib/theme";

function hasPublicImage(filename: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", "images", filename));
}

type IconProps = { className?: string; style?: React.CSSProperties };

function IconMessageCircle({ className = "", style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
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

function IconMapPin({ className = "", style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconClock({ className = "", style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

const STORE_ADDRESS =
  "Residencial Jardines 3, Pueblo Bávaro, La Altagracia, República Dominicana";

const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_ADDRESS)}`;

function WhatsAppButton({ className = "", small = false }: { className?: string; small?: boolean }) {
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold text-white ${
        small ? "px-5 py-2.5 text-sm" : "min-h-12 px-7 py-3.5 text-base"
      } ${className}`}
      style={{ backgroundColor: brand.green }}
    >
      <IconMessageCircle className={small ? "h-4 w-4" : "h-5 w-5"} />
      Pedir por WhatsApp
    </a>
  );
}

function StaffButton() {
  return (
    <Link
      href="/empleados"
      className="inline-flex min-h-10 items-center justify-center rounded-full px-5 py-2 text-sm font-bold text-white"
      style={{ backgroundColor: brand.orange }}
    >
      Empleados
    </Link>
  );
}

function SectionPhoto({
  src,
  alt,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl shadow-[0_18px_40px_rgba(26,26,26,0.12)] ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className="object-cover"
        sizes="(min-width: 768px) 480px, 100vw"
        priority={priority}
        {...(priority ? {} : { loading: "lazy" as const })}
      />
    </div>
  );
}

export default function Home() {
  const year = new Date().getFullYear();
  const hasQuienesSomos = hasPublicImage("ubicacion.webp");
  const hasUbicacion = hasPublicImage("tienda-fachada.jpeg");
  const hasPharmaStorefront = hasPublicImage("pharmaquick-storefront.jpeg");

  return (
    <main style={{ color: brand.ink }}>
      <LandingHeader />
      <LandingHero />
      <QuickCoinsBanner />

      {/* Quiénes somos */}
      <section id="quienes-somos" className="scroll-mt-20 bg-[#F1F7EA] pt-20 md:scroll-mt-24 md:pt-28">
        <LandingInner className="pb-20 md:pb-28">
          <div
            className={`grid items-center gap-10 ${hasQuienesSomos ? "md:grid-cols-2 md:gap-14" : ""}`}
          >
            {hasQuienesSomos ? (
              <SectionPhoto
                src="/images/ubicacion.webp"
                alt="Pasillo iluminado de la tienda Quick! Mini Market con estantes de productos"
                className="mx-auto aspect-[4/5] w-full max-w-md md:max-w-none"
              />
            ) : null}
            <div className={hasQuienesSomos ? "" : "mx-auto max-w-2xl"}>
              <p
                className="text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: brand.orange }}
              >
                Quiénes somos
              </p>
              <h2 className="font-display mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
                Una tienda pensada para tu comunidad
              </h2>
              <p
                className="mt-5 text-base leading-relaxed md:text-lg"
                style={{ color: brand.muted }}
              >
                Quick! Mini Market es una cadena de mini markets enfocada en comunidades residenciales.
                Nuestro objetivo es simple: traer conveniencia y buen servicio directo a donde vives,
                con la calidad y consistencia de una cadena, pero la cercanía de tu vecino de al lado.
                Abrimos nuestra primera tienda en septiembre de 2025, y desde entonces trabajamos para
                que hacer las compras del día a día sea más fácil para cada residencial donde estamos.
              </p>
              <p
                className="mt-4 text-base leading-relaxed md:text-lg"
                style={{ color: brand.muted }}
              >
                Y si prefieres no salir, construimos nuestra propia forma de pedir por WhatsApp: el
                mismo pasillo, ahora en tu celular.
              </p>
            </div>
          </div>
        </LandingInner>
        <SectionWave fill="#FFFFFF" />
      </section>

      <LandingBuyHowYouWant />
      <LandingCatalogPreview />
      <LandingDifferentiators />

      {/* PharmaQuick! */}
      <section className="relative" style={{ backgroundColor: brand.blue }}>
        <SoftCircles />
        <LandingInner className="relative z-10 py-20 md:py-28">
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
            <div>
              {hasPharmaStorefront ? (
                <SectionPhoto
                  src="/images/pharmaquick-storefront.jpeg"
                  alt="Fachada de PharmaQuick! con el logo iluminado sobre la entrada de la farmacia"
                  className="mb-6 aspect-[16/10] w-full"
                />
              ) : null}
              <div>
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold" style={{ color: brand.blue }}>
                  Próximamente
                </span>
              </div>
              <h2 className="font-display mt-4 text-4xl font-extrabold text-white md:text-5xl">
                PharmaQuick!
              </h2>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-white/90 md:text-lg">
              Muy pronto abrimos PharmaQuick!, nuestra farmacia hermana, cerca de Quick! — el mismo
              estándar de conveniencia y cercanía, ahora también para tu salud y cuidado personal.
            </p>
          </div>
        </LandingInner>
        <SectionWave fill={brand.green} />
      </section>

      {/* Ubicación */}
      <section id="donde-estamos" className="relative scroll-mt-20 md:scroll-mt-24" style={{ backgroundColor: brand.green }}>
        <SoftCircles />
        <LandingInner className="relative z-10 py-20 md:py-28">
          <div className={`grid items-center gap-12 ${hasUbicacion ? "md:grid-cols-2 md:gap-16" : ""}`}>
            <div className="text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                Ubicación
              </p>
              <h2 className="font-display mt-3 text-4xl font-extrabold md:text-5xl">Dónde estamos</h2>
              <p className="mt-5 text-base leading-relaxed text-white/90 md:text-lg">
                Hoy tenemos una tienda en el Residencial Jardines 3, Pueblo Bávaro. Y vienen más —
                estamos creciendo hacia otros residenciales próximamente.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white/15 px-5 py-4">
                <IconMapPin className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                <span className="font-semibold leading-relaxed">{STORE_ADDRESS}</span>
              </div>
              <div className="mt-3 flex items-start gap-3 rounded-2xl bg-white/15 px-5 py-4">
                <IconClock className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                <div>
                  <p className="font-semibold">Horario de atención</p>
                  <p className="mt-0.5 text-sm text-white/85">Todos los días, de 8:00 a. m. a 12:00 a. m.</p>
                </div>
              </div>
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 py-3 text-base font-bold"
                style={{ color: brand.green }}
              >
                Cómo llegar
              </a>
              {/* Aquí se puede insertar un mapa embebido de Google Maps más adelante. */}
            </div>
            {hasUbicacion ? (
              <div className="mx-auto w-full max-w-sm rotate-[2deg] bg-white p-3 shadow-[0_24px_50px_rgba(26,26,26,0.28)] md:p-4">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src="/images/tienda-fachada.jpeg"
                    alt="Entrada de Quick! Mini Market en el Residencial Jardines 3 con el logo sobre las puertas de cristal"
                    fill
                    unoptimized
                    className="object-cover object-center"
                    sizes="(min-width: 768px) 380px, 90vw"
                    loading="lazy"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </LandingInner>
        <SectionWave fill={brand.ink} />
      </section>

      {/* Footer */}
      <footer className="pb-12 pt-10 md:pt-14" style={{ backgroundColor: brand.ink }}>
        <LandingInner>
          <div className="grid gap-10 text-center md:grid-cols-3 md:gap-8 md:text-left">
            <div className="flex flex-col items-center gap-4 md:items-start">
              <Logo variant="contour" className="h-12 max-w-[180px]" />
              <WhatsAppButton small />
              <StaffButton />
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
          <p className="mt-10 text-center text-sm text-white/40">
            © {year} Quick! Mini Market
          </p>
        </LandingInner>
      </footer>
      <WhatsAppFloat />
    </main>
  );
}
