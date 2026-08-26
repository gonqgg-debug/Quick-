import Image from "next/image";
import { brand, whatsappHref } from "@/lib/theme";
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
                Traemos la conveniencia
              </span>
              <span
                className="mt-1 block text-5xl font-extrabold uppercase leading-[0.9] tracking-tight md:mt-2 md:text-7xl lg:text-8xl"
                style={{ color: brand.orange }}
              >
                A tu residencial
              </span>
            </h1>
            <p
              className="mx-auto mt-5 max-w-lg text-base leading-relaxed md:mx-0 md:mt-6 md:text-lg"
              style={{ color: brand.muted }}
            >
              Una cadena de mini markets pensada para las comunidades residenciales — la calidad y
              consistencia de una cadena, con la cercanía de estar justo donde vives.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap md:mt-8 md:items-start">
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-white"
                style={{ backgroundColor: brand.green }}
              >
                <WhatsAppIcon className="h-5 w-5" />
                Pedir por WhatsApp
              </a>
              <a
                href="#donde-estamos"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 px-7 py-3.5 text-base font-bold"
                style={{ borderColor: brand.green, color: brand.green }}
              >
                Visítanos en tienda
              </a>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Image
              src="/images/pasillos-colores-corregidos.png"
              alt="Estante de productos Quick! Mini Market"
              width={749}
              height={670}
              priority
              unoptimized
              className="h-auto w-[78%] max-w-[360px] md:max-w-[400px] lg:max-w-[440px]"
            />
          </div>
        </div>
      </LandingInner>
      <SectionWave fill="#F1F7EA" />
    </section>
  );
}

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
