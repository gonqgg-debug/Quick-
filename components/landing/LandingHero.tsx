import Image from "next/image";
import { BrandButton, Highlight, LandingSection, PhotoCard, SpeechBubble } from "@/components/landing/BrandUi";
import { brand, whatsappHref } from "@/lib/theme";

export function LandingHero() {
  return (
    <LandingSection background={brand.cream} id="inicio">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
        <div>
          <h1 className="font-display">
            <span className="block text-[clamp(34px,4.6vw,58px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#123B7A]">
              Traemos la conveniencia
            </span>
            <Highlight className="mt-2.5 rounded-[20px] px-[22px] py-1.5 text-[clamp(30px,4.2vw,52px)] font-extrabold uppercase leading-[1.12] tracking-[-0.02em]">
              A tu residencial
            </Highlight>
          </h1>
          <p className="mt-6 max-w-[44ch] text-[17px] leading-relaxed text-[#4A5568]">
            <strong className="text-[#123B7A]">Mini market de cadena, a un paso de tu casa</strong>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BrandButton href="/expansion" variant="green">
              Trae Quick! a tu comunidad
            </BrandButton>
            <BrandButton href={whatsappHref()} variant="outline">
              Pedir por WhatsApp
            </BrandButton>
          </div>
        </div>

        <PhotoCard className="h-[clamp(320px,38vw,460px)] self-stretch">
          <Image
            src="/images/landing-hero.webp"
            alt="Fachada de una tienda Quick! Mini Market dentro de un residencial"
            fill
            priority
            unoptimized
            className="object-cover object-center"
            sizes="(min-width: 768px) 520px, 100vw"
          />
          <SpeechBubble tone="blue" className="right-6 top-[30px] max-w-[210px] px-5 py-4 text-[26px]">
            Lo que necesitas, todos los días.
          </SpeechBubble>
        </PhotoCard>
      </div>
    </LandingSection>
  );
}
