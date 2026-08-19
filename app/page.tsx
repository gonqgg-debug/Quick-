import fs from "fs";
import path from "path";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LandingHeader } from "@/components/landing/LandingHeader";
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

function IconShoppingCart({ className = "", style }: IconProps) {
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
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function IconHome({ className = "", style }: IconProps) {
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
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
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

const STEPS = [
  {
    n: "1",
    title: "Escríbenos por WhatsApp",
    text: "Inicia un chat, no necesitas app ni registro.",
    Icon: IconMessageCircle,
  },
  {
    n: "2",
    title: "Arma tu pedido",
    text: "Elige del catálogo completo lo que necesitas.",
    Icon: IconShoppingCart,
  },
  {
    n: "3",
    title: "Te llega a la puerta",
    text: "Recibe todo directo en tu residencial.",
    Icon: IconHome,
  },
];

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
      href="/staff"
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

function DeliveryTrailSteps() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 900 200"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M50 160 C 150 40, 250 180, 450 100 S 650 20, 750 140 S 850 100, 850 100"
        stroke={brand.orange}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
        strokeDasharray="8 6"
      />
    </svg>
  );
}

function SectionWave({ fill }: { fill: string }) {
  return (
    <div className="section-wave" aria-hidden="true">
      <svg viewBox="0 0 1440 88" preserveAspectRatio="none">
        <path fill={fill} d="M0 46C200 90 340 8 540 34C760 62 860 94 1080 50C1240 18 1340 12 1440 40L1440 90 0 90Z" />
      </svg>
    </div>
  );
}

function SoftCircles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
      <span className="absolute -bottom-24 -left-12 h-80 w-80 rounded-full bg-white/10" />
      <span className="absolute bottom-10 right-1/4 h-32 w-32 rounded-full bg-white/[0.14]" />
    </div>
  );
}

function Inner({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto max-w-[1100px] px-6 md:px-8 ${className}`}>{children}</div>
  );
}

export default function Home() {
  const year = new Date().getFullYear();
  const hasHero = hasPublicImage("hero.jpeg");
  const hasQuienesSomos = hasPublicImage("quienes-somos.jpg");
  const hasUbicacion = hasPublicImage("ubicacion.webp");
  const hasPharmaStorefront = hasPublicImage("pharmaquick-storefront.jpeg");

  return (
    <main style={{ color: brand.ink }}>
      <LandingHeader />
      {/* Hero */}
      <section id="inicio" className="scroll-mt-20 bg-white pt-8 md:scroll-mt-24 md:pt-12">
        <Inner className="pb-8 md:pb-10">
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
            <div className="order-2 text-center md:order-1 md:text-left">
              <Logo className="mx-auto h-16 max-w-[220px] md:mx-0 md:h-20 md:max-w-[280px]" />
              <h1 className="font-display mt-6 text-balance text-4xl font-extrabold leading-[1.05] md:mt-7 md:text-6xl">
                La conveniencia de tu residencial, todos los días
              </h1>
              <p
                className="mx-auto mt-4 max-w-md text-base leading-relaxed md:mx-0 md:mt-5 md:text-xl"
                style={{ color: brand.muted }}
              >
                Quick! Mini Market lleva lo que necesitas directo a tu comunidad — sin salir del
                residencial.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap md:mt-8 md:items-start">
                <WhatsAppButton />
                <a
                  href="#donde-estamos"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border-2 px-7 py-3.5 text-base font-bold"
                  style={{ borderColor: brand.green, color: brand.green }}
                >
                  Visítanos en tienda
                </a>
              </div>
            </div>
            {hasHero ? (
              <div className="relative order-1 mx-auto w-full max-w-md md:order-2 md:max-w-none">
                <SectionPhoto
                  src="/images/hero.jpeg"
                  alt="Repartidor de Quick! Mini Market entregando una bolsa de compras en la puerta de casa"
                  priority
                  className="aspect-[4/5]"
                />
              </div>
            ) : null}
          </div>
        </Inner>
        <SectionWave fill="#F1F7EA" />
      </section>

      {/* Quiénes somos */}
      <section id="quienes-somos" className="scroll-mt-20 bg-[#F1F7EA] pt-20 md:scroll-mt-24 md:pt-28">
        <Inner className="pb-20 md:pb-28">
          <div
            className={`grid items-center gap-10 ${hasQuienesSomos ? "md:grid-cols-2 md:gap-14" : ""}`}
          >
            {hasQuienesSomos ? (
              <SectionPhoto
                src="/images/quienes-somos.jpg"
                alt="Bolsas de compras con frutas, pan y productos frescos listas para entregar"
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
            </div>
          </div>
        </Inner>
        <SectionWave fill="#FFFFFF" />
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-20 bg-white pt-20 md:scroll-mt-24 md:pt-28">
        <Inner className="pb-20 md:pb-28">
          <div className="mx-auto max-w-4xl">
            <p
              className="text-center text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: brand.orange }}
            >
              Cómo funciona
            </p>
            <h2 className="font-display mt-3 text-center text-4xl font-extrabold md:text-5xl">
              Pedir es así de simple
            </h2>
            <div className="relative mt-12">
              <div className="hidden md:block">
                <DeliveryTrailSteps />
              </div>
              <ol className="relative z-10 grid gap-4 md:grid-cols-3 md:gap-6">
                {STEPS.map((step) => (
                  <li
                    key={step.n}
                    className="rounded-3xl bg-white px-6 py-7 shadow-[0_8px_30px_rgba(26,26,26,0.08)]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold text-white"
                        style={{ backgroundColor: brand.green }}
                      >
                        {step.n}
                      </span>
                      <step.Icon className="h-6 w-6" style={{ color: brand.orange }} />
                    </div>
                    <h3 className="font-display mt-4 text-xl font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: brand.muted }}>
                      {step.text}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="relative z-10 mt-8 text-center text-sm leading-relaxed" style={{ color: brand.muted }}>
                ¿Prefieres venir en persona? Te esperamos en Residencial Jardines 3, todos los días.{" "}
                <a href="#donde-estamos" className="font-bold underline-offset-2 hover:underline" style={{ color: brand.green }}>
                  Ver ubicación
                </a>
              </p>
            </div>
          </div>
        </Inner>
        <SectionWave fill={brand.blue} />
      </section>

      {/* PharmaQuick! */}
      <section className="relative" style={{ backgroundColor: brand.blue }}>
        <SoftCircles />
        <Inner className="relative z-10 py-20 md:py-28">
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
        </Inner>
        <SectionWave fill={brand.green} />
      </section>

      {/* Ubicación */}
      <section id="donde-estamos" className="relative scroll-mt-20 md:scroll-mt-24" style={{ backgroundColor: brand.green }}>
        <SoftCircles />
        <Inner className="relative z-10 py-20 md:py-28">
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
                    src="/images/ubicacion.webp"
                    alt="Pasillo iluminado de la tienda Quick! Mini Market con estantes de productos"
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(min-width: 768px) 380px, 90vw"
                    loading="lazy"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </Inner>
        <SectionWave fill={brand.ink} />
      </section>

      {/* Footer */}
      <footer className="pb-12 pt-10 md:pt-14" style={{ backgroundColor: brand.ink }}>
        <Inner>
          <div className="grid gap-10 text-center md:grid-cols-3 md:gap-8 md:text-left">
            <div className="flex flex-col items-center gap-4 md:items-start">
              <Logo className="h-12 max-w-[180px]" />
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
        </Inner>
      </footer>
      <WhatsAppFloat />
    </main>
  );
}
