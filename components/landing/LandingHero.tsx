import { brand } from "@/lib/theme";
import { HeroIllustrations } from "@/components/landing/HeroIllustrations";
import { LandingInner, SectionWave } from "@/components/landing/LandingSection";

export function LandingHero() {
  return (
    <section
      id="inicio"
      className="scroll-mt-20 pt-10 md:scroll-mt-24 md:pt-14"
      style={{ backgroundColor: brand.cream }}
    >
      <LandingInner className="pb-10 md:pb-14">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="text-center md:text-left">
            <h1 className="font-display text-balance">
              <span
                className="block text-3xl font-semibold leading-tight md:text-5xl"
                style={{ color: brand.orange }}
              >
                Conveniencia.
              </span>
              <span
                className="mt-1 block text-6xl font-extrabold uppercase leading-[0.9] tracking-tight md:mt-2 md:text-8xl lg:text-[7.5rem]"
                style={{ color: brand.orange }}
              >
                En tu casa
              </span>
            </h1>
            <p
              className="mx-auto mt-5 max-w-md text-base leading-relaxed md:mx-0 md:mt-6 md:text-lg"
              style={{ color: brand.orange }}
            >
              Mini markets de cadena, pensados para tu residencial.
            </p>
            <div className="mt-7 flex justify-center md:mt-8 md:justify-start">
              <a
                href="#donde-estamos"
                className="inline-flex min-h-12 items-center justify-center rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-105 md:text-base"
                style={{ backgroundColor: brand.orange }}
              >
                Encontrar tienda
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-lg md:max-w-none">
            <HeroIllustrations className="mx-auto h-auto w-full max-w-[480px] md:max-w-none" />
          </div>
        </div>
      </LandingInner>
      <SectionWave fill="#F1F7EA" />
    </section>
  );
}
