import type { Metadata } from "next";
import Image from "next/image";
import { BrandButton, Highlight, IconCircle, LandingSection, PhotoCard } from "@/components/landing/BrandUi";
import { brand, whatsappHref } from "@/lib/theme";

export const metadata: Metadata = {
  title: "PharmaQuick! | Muy pronto",
  description:
    "La misma cercanía, ahora para tu salud. PharmaQuick! abre en noviembre 2026 en Bávaro y Verón.",
};

const FEATURES = [
  {
    title: "Medicamentos y salud integral",
    text: "Lo esencial para el cuidado diario, medicamentos con receta y productos de bienestar, sin salir de tu comunidad.",
    background: brand.paleGreen,
    color: brand.green,
    icon: (
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
        <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" />
        <path d="m9.5 9.5 5 5" />
      </svg>
    ),
  },
  {
    title: "El estándar que te da tranquilidad",
    text: "La misma garantía de servicio, organización y atención personalizada que caracteriza a la marca.",
    background: brand.paleBlue,
    color: brand.blue,
    icon: (
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Todo en una sola plataforma",
    text: "Donde haya Quick! y PharmaQuick!, combinas productos de ambas tiendas en un solo pedido y una sola entrega.",
    background: brand.paleOrange,
    color: brand.orange,
    icon: (
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
        <rect x="7" y="3" width="10" height="18" rx="2.4" />
        <path d="M11 18h2" />
      </svg>
    ),
  },
] as const;

export default function PharmaQuickPage() {
  return (
    <main style={{ color: brand.body, backgroundColor: brand.white }}>
      <LandingSection background={brand.white} id="inicio">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/pharma-logo.png" alt="PharmaQuick!" className="block h-10 w-auto" />
            <span className="mt-3 block text-xs font-bold uppercase tracking-[0.18em] text-[#1F82C5]">
              Próximamente · Nov 2026
            </span>
            <h1 className="mt-3.5 font-display text-[clamp(32px,4.4vw,54px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#123B7A]">
              La misma cercanía,{" "}
              <Highlight color={brand.blue}>para tu salud</Highlight>
            </h1>
            <p className="mt-[18px] max-w-[46ch] text-[17px] leading-relaxed">
              La misma conveniencia que ya conoces, ahora con un propósito dedicado a tu bienestar.
              Una propuesta diseñada para cuidar de ti y de tu familia con acceso fácil, seguridad y
              total tranquilidad.
            </p>
            <div className="mt-[26px] grid gap-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="flex gap-3.5 rounded-[20px] px-5 py-4"
                  style={{ backgroundColor: feature.background }}
                >
                  <IconCircle color={feature.color} size={42}>
                    {feature.icon}
                  </IconCircle>
                  <span>
                    <span className="block font-display text-[19px] font-extrabold text-[#123B7A]">
                      {feature.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed">{feature.text}</span>
                  </span>
                </article>
              ))}
            </div>
            <div className="mt-7">
              <BrandButton href={whatsappHref()} variant="blue">
                Escríbenos
              </BrandButton>
            </div>
          </div>
          <PhotoCard className="h-[clamp(340px,40vw,500px)] self-stretch">
            <Image
              src="/images/pharmaquick-storefront.jpeg"
              alt="Fachada de PharmaQuick!"
              fill
              priority
              unoptimized
              className="object-cover object-center"
              sizes="(min-width: 768px) 520px, 100vw"
            />
          </PhotoCard>
        </div>
      </LandingSection>

      <LandingSection background={brand.paleBlue} id="muy-pronto">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <h2 className="font-display text-[clamp(26px,3.2vw,40px)] font-extrabold leading-tight tracking-[-0.03em] text-[#123B7A]">
            ¿Quieres PharmaQuick! en tu comunidad?
          </h2>
          <div>
            <p className="mb-6 text-[17px] leading-relaxed">
              Estamos evaluando ubicaciones para las próximas aperturas en el área de Bávaro y Verón.
              Escríbenos y conversamos.
            </p>
            <BrandButton href={whatsappHref()} variant="blue">
              Escribir por WhatsApp
            </BrandButton>
          </div>
        </div>
      </LandingSection>
    </main>
  );
}
