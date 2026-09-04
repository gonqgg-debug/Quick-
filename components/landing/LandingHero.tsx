import Image from "next/image";
import { brand } from "@/lib/theme";
import { LandingInner } from "@/components/landing/LandingSection";

export function LandingHero() {
  return (
    <section
      id="inicio"
      className="scroll-mt-20 pt-16 md:scroll-mt-24 md:pt-24"
      style={{ backgroundColor: brand.cream }}
    >
      <LandingInner className="pb-16 md:pb-24 max-md:!px-4">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
          <div className="text-center md:text-left">
            <h1 className="font-display">
              <span
                className="block whitespace-nowrap text-3xl font-semibold leading-tight md:text-5xl"
                style={{ color: brand.orange }}
              >
                Traemos la conveniencia
              </span>
              <span
                className="mt-1 block whitespace-nowrap text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.04em] md:mt-2 md:text-7xl md:tracking-tight lg:text-8xl"
                style={{ color: brand.orange }}
              >
                A tu residencial
              </span>
            </h1>
            <p
              className="mx-auto mt-5 max-w-md text-base leading-relaxed md:mx-0 md:mt-6"
              style={{ color: brand.muted }}
            >
              Mini market de cadena, a un paso de tu casa.
            </p>
            <div className="mt-7 flex justify-center md:mt-8 md:justify-start">
              <a
                href="#donde-estamos"
                className="inline-flex min-h-12 items-center justify-center rounded-full px-8 py-3.5 text-base font-bold text-white"
                style={{ backgroundColor: brand.green }}
              >
                Visítanos
              </a>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Image
              src="/images/tienda-isometrica.png"
              alt="Interior de Quick! Mini Market"
              width={743}
              height={819}
              priority
              unoptimized
              className="h-auto w-[88%] max-w-[400px] md:max-w-[460px] lg:max-w-[520px]"
            />
          </div>
        </div>
      </LandingInner>
    </section>
  );
}
