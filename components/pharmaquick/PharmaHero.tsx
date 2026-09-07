import Image from "next/image";
import { brand } from "@/lib/theme";
import { LandingInner } from "@/components/landing/LandingSection";

export function PharmaHero() {
  return (
    <section
      id="inicio"
      className="scroll-mt-20 pt-16 md:scroll-mt-24 md:pt-24"
      style={{ backgroundColor: "#EAF4FB" }}
    >
      <LandingInner className="max-md:!px-4 pb-16 md:pb-24">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
          <div className="min-w-0 text-center md:text-left">
            <h1 className="font-display">
              <span
                className="block max-md:whitespace-nowrap text-3xl font-semibold leading-tight md:text-5xl"
                style={{ color: brand.blue }}
              >
                Muy pronto
              </span>
              <span
                className="mt-1 block max-md:whitespace-nowrap text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.04em] md:mt-2 md:text-6xl md:tracking-tight lg:text-7xl"
                style={{ color: brand.blue }}
              >
                Tu farmacia
              </span>
            </h1>
            <p
              className="mx-auto mt-5 max-w-lg text-base leading-relaxed md:mx-0 md:mt-6"
              style={{ color: brand.muted }}
            >
              PharmaQuick! es la farmacia hermana de Quick! Mini Market. Llegamos a Plaza Crisfer
              para que cuidar tu salud sea tan fácil como bajar a la plaza.
            </p>
            <div className="mt-7 flex justify-center md:mt-8 md:justify-start">
              <a
                href="#muy-pronto"
                className="inline-flex min-h-12 items-center justify-center rounded-full px-8 py-3.5 text-base font-bold text-white"
                style={{ backgroundColor: brand.blue }}
              >
                Conoce más
              </a>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Image
              src="/images/pharmaquick-storefront.jpeg"
              alt="Fachada de PharmaQuick!"
              width={743}
              height={819}
              priority
              unoptimized
              className="h-auto w-[88%] max-w-[400px] rounded-3xl object-cover shadow-[0_18px_40px_rgba(26,26,26,0.12)] md:max-w-[460px] lg:max-w-[520px]"
            />
          </div>
        </div>
      </LandingInner>
    </section>
  );
}
