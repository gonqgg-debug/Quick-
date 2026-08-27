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
    "Mini markets de cadena pensados para comunidades residenciales. Conveniencia y cercanía, directo a donde vives.",
};

function hasPublicImage(filename: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", "images", filename));
}

export default function QuienesSomosPage() {
  const hasPhoto = hasPublicImage("ubicacion.webp");

  return (
    <main style={{ color: brand.ink, backgroundColor: brand.cream }}>
      <LandingHeader />
      <section className="pt-16 md:pt-24">
        <LandingInner className="pb-20 md:pb-28">
          <div className={`grid items-center gap-10 ${hasPhoto ? "md:grid-cols-2 md:gap-14" : ""}`}>
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
                Una tienda pensada para tu comunidad
              </h1>
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
        <SectionWave fill={brand.ink} />
      </section>
      <LandingFooter />
      <WhatsAppFloat />
    </main>
  );
}
