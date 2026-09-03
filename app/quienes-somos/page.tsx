import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import Image from "next/image";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingInner, SectionWave } from "@/components/landing/LandingSection";
import { WhatsAppFloat } from "@/components/landing/WhatsAppFloat";
import { brand } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Quiénes somos | Quick! Mini Market",
  description:
    "Nacimos para que no tengas que ir lejos por lo que necesitas cada día. Mini markets de cadena para comunidades residenciales.",
};

function hasPublicImage(filename: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", "images", filename));
}

const VALUES = [
  {
    name: "Cercanía",
    description: "Abrimos donde vives, no donde es más fácil para nosotros.",
    color: brand.green,
  },
  {
    name: "Consistencia",
    description: "Calidad de cadena, trato de vecino.",
    color: brand.orange,
  },
  {
    name: "Simplicidad",
    description: "Lo que necesitas, sin complicaciones.",
    color: brand.blue,
  },
  {
    name: "Innovación",
    description: "Siempre buscando cómo hacer la experiencia más fácil para ti.",
    color: brand.green,
  },
] as const;

export default function QuienesSomosPage() {
  const hasPhoto = hasPublicImage("ubicacion.webp");

  return (
    <main style={{ color: brand.ink, backgroundColor: brand.cream }}>
      <LandingHeader />

      {/* Hero */}
      <section className="pt-16 md:pt-24">
        <LandingInner className="pb-20 md:pb-28">
          <div
            className={`grid items-center gap-10 ${hasPhoto ? "md:grid-cols-2 md:gap-14" : ""}`}
          >
            {hasPhoto ? (
              <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl shadow-[0_18px_40px_rgba(26,26,26,0.12)] md:max-w-none">
                <Image
                  src="/images/ubicacion.webp"
                  alt="Pasillo iluminado de la tienda Quick! Mini Market con estantes de productos"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(min-width: 768px) 480px, 100vw"
                  priority
                />
              </div>
            ) : null}
            <div className={hasPhoto ? "" : "mx-auto max-w-2xl"}>
              <p
                className="text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: brand.orange }}
              >
                Quiénes somos
              </p>
              <h1 className="font-display mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
                Nacimos para que no tengas que ir lejos por lo que necesitas
                cada día.
              </h1>
              <p
                className="mt-5 text-base leading-relaxed md:text-lg"
                style={{ color: brand.muted }}
              >
                Quick! Mini Market es una cadena de mini markets diseñada desde
                cero para comunidades residenciales. Creemos que la conveniencia
                no debería estar a 20 minutos en carro — debería estar a pasos
                de tu casa. Por eso abrimos tiendas dentro de los residenciales
                donde vives, con los productos que necesitas todos los días y un
                servicio que se mantiene consistente en cada tienda.
              </p>
            </div>
          </div>
        </LandingInner>
      </section>

      {/* Propósito y Valores */}
      <section style={{ backgroundColor: brand.ink }}>
        <LandingInner className="py-20 md:py-28">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            {/* Propósito */}
            <div>
              <p
                className="text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: brand.orange }}
              >
                Propósito
              </p>
              <p className="mt-4 text-lg leading-relaxed text-white/90 md:text-xl">
                Que nadie tenga que ir lejos por lo básico. Existimos para
                llevar conveniencia real a comunidades residenciales, con un
                servicio que se siente cercano y una operación que crece junto a
                los vecinos que nos reciben.
              </p>
            </div>

            {/* Valores */}
            <div>
              <p
                className="text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: brand.orange }}
              >
                Valores
              </p>
              <div className="mt-4 grid gap-4">
                {VALUES.map((v) => (
                  <div key={v.name} className="flex items-start gap-3">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: v.color }}
                    />
                    <div>
                      <p className="font-display text-base font-bold text-white">
                        {v.name}
                      </p>
                      <p className="text-sm leading-relaxed text-white/70">
                        {v.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </LandingInner>
        <SectionWave fill={brand.cream} />
      </section>

      <LandingFooter />
      <WhatsAppFloat />
    </main>
  );
}
