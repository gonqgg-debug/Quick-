import { brand } from "@/lib/theme";
import { Highlight, IconCircle, LandingSection } from "@/components/landing/BrandUi";

const PILLARS = [
  {
    title: "Tiendas en residenciales",
    text: "Dentro de comunidades del área de Bávaro y Verón.",
    color: brand.green,
    background: brand.paleGreen,
    icon: (
      <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 9-7 9 7" />
        <path d="M5.5 10v10h13V10" />
      </svg>
    ),
  },
  {
    title: "Un solo estándar",
    text: "Misma calidad, higiene y atención en cada sucursal de la cadena.",
    color: brand.blue,
    background: brand.paleBlue,
    icon: (
      <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Lo del día a día",
    text: "Las categorías y marcas que ya buscas, sin vueltas.",
    color: brand.orange,
    background: brand.paleOrange,
    icon: (
      <svg viewBox="0 0 24 24" width="23" height="23" fill="#fff">
        <path d="M7.2 4.2h.9l.4 1.6h11.2c.6 0 1 .5.9 1.1l-1.1 6.2a1.8 1.8 0 0 1-1.8 1.5H9.3a1.8 1.8 0 0 1-1.8-1.5L6.1 4.8H4.2a.9.9 0 1 1 0-1.8h2.1c.4 0 .8.3.9.7l.2.7zm1.6 10.7a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4zm8.6 0a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z" />
      </svg>
    ),
  },
] as const;

const CATEGORIES = [
  ["🥬", "Frutas y vegetales"],
  ["🥩", "Carnes y embutidos"],
  ["🥛", "Lácteos y refrigerados"],
  ["🥖", "Panadería"],
  ["🥣", "Desayuno"],
  ["🍝", "Cocina y abarrotes"],
  ["🧊", "Congelados"],
  ["🍪", "Snacks y antojos"],
  ["🥤", "Bebidas"],
  ["🍷", "Cervezas y vinos"],
  ["🧴", "Cuidado personal"],
  ["🧹", "Hogar y limpieza"],
  ["🍼", "Bebé"],
  ["🐾", "Mascotas"],
] as const;

export function LandingValue() {
  return (
    <LandingSection background={brand.white}>
      <div className="grid items-end gap-6 md:grid-cols-2 md:gap-14">
        <h2 className="font-display text-[clamp(30px,3.8vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#123B7A]">
          Una cadena pensada para <Highlight>residenciales</Highlight>
        </h2>
        <p className="text-[17px] leading-relaxed text-[#4A5568]">
          Llevamos un mini market de primer nivel a la puerta de tu casa. Nos integramos a tu
          residencial o plaza local para ofrecerte la calidad de una gran cadena con la calidez y la
          atención personalizada que te mereces.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PILLARS.map((item) => (
          <article
            key={item.title}
            className="rounded-[22px] px-[26px] pb-7 pt-[26px]"
            style={{ backgroundColor: item.background }}
          >
            <IconCircle color={item.color}>{item.icon}</IconCircle>
            <h3 className="font-display mt-[18px] text-xl font-extrabold leading-tight text-[#123B7A]">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#4A5568]">{item.text}</p>
          </article>
        ))}
      </div>

      <div className="mt-16 border-t border-black/[0.08] pt-12 md:mt-[88px] md:pt-14">
        <h3 className="max-w-[24ch] font-display text-[clamp(24px,2.8vw,34px)] font-extrabold leading-tight tracking-[-0.02em] text-[#123B7A]">
          Mini market para tu vida diaria, <Highlight className="rounded-[14px] px-4">siempre a la mano.</Highlight>
        </h3>
        <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-[#4A5568]">
          El surtido completo de la cadena, igual en cada tienda.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          {CATEGORIES.map(([emoji, label]) => (
            <span
              key={label}
              className="inline-flex items-center gap-2.5 rounded-full border border-black/[0.08] bg-white py-[9px] pl-3 pr-[18px] font-display text-base font-bold leading-tight text-[#123B7A]"
            >
              <span className="text-lg leading-none">{emoji}</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
