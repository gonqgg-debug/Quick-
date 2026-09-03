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
      <header className="pt-16 md:pt-24">
        <LandingInner className="pb-14 md:pb-16">
          <span
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: brand.orange }}
          >
            QUIÉNES SOMOS
          </span>
          <h1 className="font-display mt-4 max-w-4xl text-4xl font-extrabold leading-tight md:text-6xl">
            Nacimos para que no tengas que ir lejos por lo que necesitas cada día.
          </h1>
        </LandingInner>
      </header>

      <section>
        <LandingInner className="pb-20 md:pb-24">
          <div className={`grid items-start gap-10 ${hasPhoto ? "md:grid-cols-2 md:gap-14" : ""}`}>
            <div className={hasPhoto ? "" : "max-w-3xl"}>
              <h2 className="font-display text-2xl font-bold md:text-3xl">
                Una nueva forma de la conveniencia de todos los días
              </h2>
              <p className="mt-5 text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
                Quick! Mini Market es una cadena de mini markets diseñada desde cero para comunidades
                residenciales. Creemos que la conveniencia no debería estar a 20 minutos en carro —
                debería estar a pasos de tu casa. Por eso abrimos tiendas dentro de los residenciales
                donde vives, con los productos que necesitas todos los días y un servicio que se
                mantiene consistente en cada tienda.
              </p>
            </div>
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
          </div>
        </LandingInner>
      </section>

      <section style={{ backgroundColor: brand.ink }}>
        <LandingInner className="py-20 md:py-24">
          <div className="grid gap-6 md:grid-cols-2">
            <article className="rounded-3xl bg-white/10 p-7 md:p-8">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-white">Propósito</h3>
              <p className="mt-4 text-base leading-relaxed text-white/85 md:text-lg">
                Que nadie tenga que ir lejos por lo básico. Existimos para llevar conveniencia real a
                comunidades residenciales, con un servicio que se siente cercano y una operación que
                crece junto a los vecinos que nos reciben.
              </p>
            </article>
            <article className="rounded-3xl bg-white/10 p-7 md:p-8">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-white">Valores</h3>
              <div className="mt-4 space-y-3 text-white/85">
                {VALUES.map((value) => (
                  <p key={value.name} className="text-base leading-relaxed">
                    <span className="font-bold text-white">{value.name}:</span> {value.description}
                  </p>
                ))}
              </div>
            </article>
          </div>
        </LandingInner>
        <SectionWave fill={brand.cream} />
      </section>

      <LandingFooter />
      <WhatsAppFloat />
    </main>
  );
}
