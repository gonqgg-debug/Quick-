import Image from "next/image";
import { BrandButton, LandingSection, PhotoCard, SpeechBubble } from "@/components/landing/BrandUi";
import { brand, whatsappHref } from "@/lib/theme";

export function LandingExpansionCta() {
  return (
    <LandingSection background={brand.cream}>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <PhotoCard className="h-[clamp(320px,38vw,460px)] self-stretch">
          <Image
            src="/images/entrega-apartamento.webp"
            alt="Entrega de un pedido Quick! en la puerta del apartamento"
            fill
            unoptimized
            className="object-cover object-[center_20%]"
            sizes="(min-width: 768px) 520px, 100vw"
          />
          <SpeechBubble tone="green" className="left-5 top-6 max-w-[200px] px-5 py-[15px] text-[26px]">
            Más cerca de tu día a día.
          </SpeechBubble>
        </PhotoCard>
        <div>
          <h2 className="font-display text-[clamp(28px,3.6vw,44px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#F79521]">
            ¿Tu residencial tiene un espacio para Quick!?
          </h2>
          <p className="mt-3.5 max-w-[48ch] text-lg leading-relaxed text-[#4A5568]">
            Hablemos. Evaluamos locales bien ubicados, espacios dentro de residenciales y alianzas a
            largo plazo.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <BrandButton href="/expansion" variant="green">
              Enviar una propuesta
            </BrandButton>
            <BrandButton href={whatsappHref()} variant="outline">
              Escribir por WhatsApp
            </BrandButton>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
