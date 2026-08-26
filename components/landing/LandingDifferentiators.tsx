import { brand } from "@/lib/theme";
import { LandingInner, SectionEyebrow, SectionWave } from "@/components/landing/LandingSection";

const CONTRASTS = [
  {
    before: "Mandar una lista por chat",
    after: "Ver el pasillo con fotos y precios en tu celular",
  },
  {
    before: "No saber si hay o cuánto cuesta",
    after: "Catálogo actualizado con precios claros",
  },
  {
    before: "Esperar sin saber qué pasa",
    after: "Seguir tu pedido y cambiarlo si hace falta",
  },
] as const;

export function LandingDifferentiators() {
  return (
    <section className="bg-white pt-20 md:pt-28">
      <LandingInner className="pb-20 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow centered>La diferencia</SectionEyebrow>
          <h2 className="font-display mt-3 text-4xl font-extrabold md:text-5xl">
            No es el mini market de siempre
          </h2>
          <p className="mt-4 text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
            Quick! combina la tienda de tu residencial con una experiencia digital pensada para
            pedir desde el celular.
          </p>
        </div>
        <ul className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-3 md:gap-6">
          {CONTRASTS.map((item) => (
            <li
              key={item.before}
              className="rounded-3xl bg-[#F9FAFB] px-6 py-7 shadow-[0_8px_30px_rgba(26,26,26,0.06)]"
            >
              <p className="text-sm leading-relaxed line-through" style={{ color: brand.muted }}>
                {item.before}
              </p>
              <p className="font-display mt-3 text-base font-bold leading-snug md:text-lg">{item.after}</p>
            </li>
          ))}
        </ul>
      </LandingInner>
      <SectionWave fill={brand.blue} />
    </section>
  );
}
