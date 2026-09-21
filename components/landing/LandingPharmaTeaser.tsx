import Image from "next/image";
import { BrandButton, LandingSection, PhotoCard } from "@/components/landing/BrandUi";
import { brand } from "@/lib/theme";

export function LandingPharmaTeaser() {
  return (
    <LandingSection background={brand.paleBlue}>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/pharma-logo.png" alt="PharmaQuick!" className="block h-10 w-auto" />
          <span className="mt-3 block text-xs font-bold uppercase tracking-[0.18em] text-[#1F82C5]">
            Próximamente · Nov 2026
          </span>
          <h2 className="mt-3.5 font-display text-[clamp(28px,3.4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#123B7A]">
            La misma cercanía, ahora para tu salud
          </h2>
          <p className="mb-7 mt-[18px] max-w-[44ch] text-[17px] leading-relaxed text-[#4A5568]">
            PharmaQuick! es la farmacia hermana de Quick! Mini Market. Misma forma de atenderte, un
            propósito distinto: tu bienestar y el de tu familia, cerca de casa.
          </p>
          <BrandButton href="/pharmaquick" variant="blue">
            Conoce PharmaQuick!
          </BrandButton>
        </div>
        <PhotoCard className="h-[clamp(320px,36vw,430px)] self-stretch">
          <Image
            src="/images/pharmaquick-storefront.jpeg"
            alt="Fachada de PharmaQuick!"
            fill
            unoptimized
            className="object-cover object-center"
            sizes="(min-width: 768px) 520px, 100vw"
          />
        </PhotoCard>
      </div>
    </LandingSection>
  );
}
