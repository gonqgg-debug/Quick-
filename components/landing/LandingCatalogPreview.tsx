import Image from "next/image";
import { brand } from "@/lib/theme";
import { LandingInner, SectionEyebrow, SectionWave } from "@/components/landing/LandingSection";

const FEATURES = [
  {
    title: "Catálogo con fotos y precios",
    text: "Busca por producto, marca o categoría. Ves lo mismo que en el pasillo, en tu celular.",
  },
  {
    title: "Repite tu pedido al instante",
    text: "Lo más pedido en el residencial, tus favoritos y tu última compra, listos para agregar.",
  },
  {
    title: "Seguimiento y cambios",
    text: "Consulta el estado, modifica o cancela desde WhatsApp mientras preparamos tu pedido.",
  },
  {
    title: "¿No lo encuentras?",
    text: "Pide el producto aunque no esté en el catálogo. El equipo lo revisa y te confirma.",
  },
] as const;

function PhoneFrame() {
  return (
    <div className="mx-auto w-full max-w-[280px] md:max-w-[300px]">
      <div
        className="relative rounded-[2.75rem] border-[10px] border-[#1A1A1A] bg-[#1A1A1A] p-2 shadow-[0_24px_60px_rgba(26,26,26,0.28)]"
        aria-hidden="true"
      >
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-[#1A1A1A]" />
        <div className="relative overflow-hidden rounded-[2rem] bg-white">
          <div className="relative aspect-[9/19.5] w-full">
            <Image
              src="/images/catalogo-screenshot.png"
              alt="Catálogo de Quick! Mini Market en el celular: búsqueda, productos con precios y botón para agregar al pedido"
              fill
              unoptimized
              className="object-cover object-[center_12%] scale-[1.08]"
              sizes="(min-width: 768px) 300px, 280px"
              priority={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingCatalogPreview() {
  return (
    <section id="catalogo" className="scroll-mt-20 bg-[#F1F7EA] pt-20 md:scroll-mt-24 md:pt-28">
      <LandingInner className="pb-20 md:pb-28">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <SectionEyebrow>En el celular</SectionEyebrow>
            <h2 className="font-display mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
              Tu mini market, ahora en el celular
            </h2>
            <p className="mt-5 text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
              No es mandar una lista por chat. Es abrir el catálogo completo desde WhatsApp — con
              fotos, precios y confirmación por el mismo chat.
            </p>
            <ul className="mt-8 space-y-5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: brand.green }}
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-display text-lg font-bold">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed md:text-base" style={{ color: brand.muted }}>
                      {feature.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <PhoneFrame />
        </div>
      </LandingInner>
      <SectionWave fill="#FFFFFF" />
    </section>
  );
}
