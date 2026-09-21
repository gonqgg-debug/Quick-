import Image from "next/image";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Highlight, IconCircle, LandingSection, PhotoCard, SpeechBubble } from "@/components/landing/BrandUi";
import { brand } from "@/lib/theme";

const FEATURES = [
  {
    title: "Catálogo con fotos y precios",
    text: "Busca por producto, marca o categoría, con la variedad del pasillo.",
    background: brand.paleGreen,
    color: brand.green,
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
        <rect x="7" y="3" width="10" height="18" rx="2.4" />
        <path d="M11 18h2" />
      </svg>
    ),
  },
  {
    title: "Repite tu pedido al instante",
    text: "Tus favoritos y lo más pedido en tu residencial, listos para agregar.",
    background: brand.paleOrange,
    color: brand.orange,
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
        <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />
      </svg>
    ),
  },
  {
    title: "Seguimiento y cambios",
    text: "Consulta el estado, modifica o cancela desde WhatsApp.",
    background: brand.paleBlue,
    color: brand.blue,
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v9H3z" />
        <path d="M14 10h4l3 3v3h-7z" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17.5" cy="18" r="1.6" />
      </svg>
    ),
  },
  {
    title: "¿No lo encuentras?",
    text: "Pídelo por el chat aunque no esté en el catálogo y lo verificamos.",
    background: brand.paleGreen,
    color: brand.green,
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-3.4-3.4" />
      </svg>
    ),
  },
] as const;

export function LandingCatalogPreview() {
  return (
    <LandingSection background={brand.cream}>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <h2 className="font-display text-[clamp(30px,3.8vw,46px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#123B7A]">
            Tu mini market,
          </h2>
          <Highlight className="mt-2 rounded-[18px] px-5 py-1 text-[clamp(28px,3.6vw,44px)] font-extrabold leading-[1.18]">
            ahora en tu celular.
          </Highlight>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-[#4A5568]">
            No es mandar una lista por chat. Es abrir el catálogo de tu tienda desde WhatsApp: fotos,
            precios en tiempo real y el pedido gestionado por el mismo chat.
          </p>
          <div className="mt-[26px] grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="flex gap-3 rounded-[18px] px-4 py-3.5"
                style={{ backgroundColor: feature.background }}
              >
                <IconCircle color={feature.color} size={36}>
                  {feature.icon}
                </IconCircle>
                <span>
                  <span className="block font-display text-base font-extrabold text-[#123B7A]">
                    {feature.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[#4A5568]">{feature.text}</span>
                </span>
              </article>
            ))}
          </div>
        </div>

        <PhotoCard className="relative flex min-h-[clamp(480px,44vw,600px)] items-center justify-center self-stretch bg-white py-8">
          <PhoneFrame className="w-[260px]">
            <Image
              src="/images/catalogo-screenshot.png"
              alt="Catálogo Quick! en el celular"
              fill
              unoptimized
              className="object-cover object-top"
              sizes="260px"
            />
          </PhoneFrame>
          <SpeechBubble tone="cream" className="right-2.5 top-1.5 max-w-[170px] px-[18px] py-3.5">
            Fácil. Rápido. Seguro.
          </SpeechBubble>
        </PhotoCard>
      </div>
    </LandingSection>
  );
}
