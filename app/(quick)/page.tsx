import fs from "fs";
import path from "path";
import Image from "next/image";
import { LandingCatalogPreview } from "@/components/landing/LandingCatalogPreview";
import { LandingHero } from "@/components/landing/LandingHero";
import { QuickCoinsBanner } from "@/components/landing/QuickCoinsBanner";
import { LandingInner, SectionWave, SoftCircles } from "@/components/landing/LandingSection";
import { brand } from "@/lib/theme";

function hasPublicImage(filename: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", "images", filename));
}

type IconProps = { className?: string };

function IconMapPin({ className = "" }: IconProps) {
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
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconClock({ className = "" }: IconProps) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

const STORE_ADDRESS =
  "Residencial Jardines 3, Pueblo Bávaro, La Altagracia, República Dominicana";

const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_ADDRESS)}`;

export default function Home() {
  const hasUbicacion = hasPublicImage("tienda-fachada.jpeg");

  return (
    <main style={{ color: brand.ink }}>
      <LandingHero />
      <QuickCoinsBanner />
      <LandingCatalogPreview />

      <section
        id="donde-estamos"
        className="relative scroll-mt-20 md:scroll-mt-24"
        style={{ backgroundColor: brand.green }}
      >
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

    </main>
  );
}
