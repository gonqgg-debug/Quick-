import type { Metadata } from "next";
import Image from "next/image";
import { PharmaHero } from "@/components/pharmaquick/PharmaHero";
import { LandingInner, SectionWave, SoftCircles } from "@/components/landing/LandingSection";
import { brand } from "@/lib/theme";

export const metadata: Metadata = {
  title: "PharmaQuick! | Muy pronto",
  description:
    "Muy pronto abrimos PharmaQuick!, nuestra farmacia hermana. Salud y conveniencia, a pasos de tu casa.",
};

const STORE_ADDRESS =
  "Plaza Crisfer, Local 11, Pueblo Bávaro, La Altagracia, República Dominicana";

const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_ADDRESS)}`;

const FEATURES = [
  {
    title: "Medicamentos y cuidado personal",
    text: "Lo esencial para tu salud del día a día: medicamentos, vitaminas y cuidado personal, sin dar vueltas por fuera del residencial.",
  },
  {
    title: "La misma cercanía de Quick!",
    text: "Calidad de cadena, trato de vecino. Si ya conoces Quick!, vas a reconocer cómo se siente PharmaQuick!.",
  },
  {
    title: "Un espacio de confianza",
    text: "Estamos armando cada detalle para que pedir, consultar y volver sea simple — la farmacia de tu comunidad, no una más en la carretera.",
  },
] as const;

export default function PharmaQuickPage() {
  return (
    <main style={{ color: brand.ink }}>
      <PharmaHero />

      <section
        id="muy-pronto"
        className="scroll-mt-20 md:scroll-mt-24"
        style={{ backgroundColor: brand.blue }}
      >
        <LandingInner className="py-16 md:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Muy pronto</p>
          <h2
            className="font-display mt-3 text-4xl font-black uppercase leading-[1.05] md:text-6xl"
            style={{ color: "#EAF4FB" }}
          >
            Abrimos PharmaQuick!
          </h2>
          <p className="mt-5 max-w-2xl text-base text-white/90 md:text-lg">
            Estamos preparando una farmacia pensada para el día a día: medicamentos, cuidado
            personal y lo que necesitas para tu bienestar, con la misma cercanía y consistencia que
            ya conoces de Quick!. Un espacio de confianza, a pasos de casa.
          </p>
        </LandingInner>
      </section>

      <section className="bg-[#EAF4FB] pt-20 md:pt-28">
        <LandingInner className="pb-20 md:pb-28">
          <h2 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">
            La misma conveniencia.
            <br />
            Un propósito distinto.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
            Nacimos para que no tengas que ir lejos por lo básico. PharmaQuick! lleva esa idea a la
            farmacia: un lugar cercano, claro y de confianza para lo que tu familia necesita. Misma
            forma de atenderte. Un propósito distinto — tu salud.
          </p>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <span
                  className="mb-3 block h-2 w-2 rounded-full"
                  style={{ backgroundColor: brand.blue }}
                  aria-hidden="true"
                />
                <h3 className="font-display text-lg font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed md:text-base" style={{ color: brand.muted }}>
                  {feature.text}
                </p>
              </li>
            ))}
          </ul>
        </LandingInner>
        <SectionWave fill={brand.blue} />
      </section>

      <section
        id="donde-estamos"
        className="relative scroll-mt-20 md:scroll-mt-24"
        style={{ backgroundColor: brand.blue }}
      >
        <SoftCircles />
        <LandingInner className="relative z-10 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
            <div className="text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                Ubicación
              </p>
              <h2 className="font-display mt-3 text-4xl font-extrabold md:text-5xl">
                Dónde vamos a estar
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/90 md:text-lg">
                PharmaQuick! abre en Plaza Crisfer, Local 11, Pueblo Bávaro. Cerca de casa, fácil de
                llegar y pensada para que resolver lo de la farmacia no se vuelva un viaje.
              </p>
              <div className="mt-6 rounded-2xl bg-white/15 px-5 py-4 font-semibold leading-relaxed">
                {STORE_ADDRESS}
              </div>
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 py-3 text-base font-bold"
                style={{ color: brand.blue }}
              >
                Cómo llegar
              </a>
            </div>
            <div className="mx-auto w-full max-w-sm rotate-[2deg] bg-white p-3 shadow-[0_24px_50px_rgba(26,26,26,0.28)] md:p-4">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src="/images/pharmaquick-storefront.jpeg"
                  alt="Fachada de PharmaQuick! en Plaza Crisfer"
                  fill
                  unoptimized
                  className="object-cover object-center"
                  sizes="(min-width: 768px) 380px, 90vw"
                />
              </div>
            </div>
          </div>
        </LandingInner>
        <SectionWave fill={brand.ink} />
      </section>
    </main>
  );
}
