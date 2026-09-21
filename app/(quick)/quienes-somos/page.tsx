import type { Metadata } from "next";
import Image from "next/image";
import { Eyebrow, Highlight, LandingSection, PhotoCard, SpeechBubble } from "@/components/landing/BrandUi";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { brand } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Quiénes somos | Quick! Mini Market",
  description:
    "Nacimos para que no tengas que ir lejos por lo que necesitas cada día. Mini markets de cadena para comunidades residenciales.",
};

const FAQ_ITEMS = [
  {
    question: "¿Qué es Quick! Mini Market?",
    answer:
      "Una cadena de mini markets pensada para comunidades residenciales. Traemos productos del día a día directo a donde vives, con la consistencia de una cadena y la cercanía de tu vecino.",
  },
  {
    question: "¿Dónde están ubicados?",
    answer:
      "Dentro de residenciales del área de Bávaro y Verón, La Altagracia. Escríbenos por WhatsApp con el nombre de tu residencial y te decimos cuál tienda te atiende.",
  },
  {
    question: "¿Tienen programa de lealtad?",
    answer:
      "Sí. QuickCoins es nuestro programa de lealtad: ganas puntos con cada compra y los cambias por descuentos en tu próximo pedido, en cualquier tienda de la cadena.",
  },
] as const;

const ASSORTMENT = [
  { emoji: "🥬", title: "Frutas y vegetales", text: "Lo fresco de la semana.", background: "#F1F7EA", color: "#7EB341" },
  { emoji: "🥣", title: "Desayuno", text: "Café, pan, cereales y huevos.", background: "#FDF1DE", color: "#F79521" },
  { emoji: "🍝", title: "Cocina y abarrotes", text: "Aceites, arroz, pastas y enlatados.", background: "#EAF4FB", color: "#1F82C5" },
  { emoji: "🥛", title: "Lácteos y refrigerados", text: "Leche, yogurt, quesos y básicos.", background: "#F1F7EA", color: "#4FA3DB" },
  { emoji: "🍪", title: "Snacks y antojos", text: "Chips, galletas y los favoritos.", background: "#EAF4FB", color: "#7EB341" },
  { emoji: "🥤", title: "Bebidas", text: "Agua, jugos, refrescos y hielo.", background: "#FDF1DE", color: "#F79521" },
  { emoji: "🧴", title: "Cuidado personal", text: "Higiene, salud dental y baño.", background: "#F1F7EA", color: "#7EB341" },
  { emoji: "🧹", title: "Hogar y limpieza", text: "Detergentes, papel y desechables.", background: "#EAF4FB", color: "#4FA3DB" },
  { emoji: "🍼", title: "Bebés y mascotas", text: "Pañales, fórmula y urgencias.", background: "#FDF1DE", color: "#F79521" },
  { emoji: "🧊", title: "Congelados", text: "Helados, vegetales y comidas prácticas.", background: "#F1F7EA", color: "#7EB341" },
] as const;

export default function QuienesSomosPage() {
  return (
    <main style={{ color: brand.body, backgroundColor: brand.cream }}>
      <LandingSection background={brand.cream}>
        <Eyebrow>Quiénes somos</Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(34px,5vw,60px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#123B7A]">
          Una cadena de conveniencia <Highlight>cotidiana</Highlight>
        </h1>
        <p className="mt-5 max-w-[62ch] text-lg leading-relaxed">
          Un poco sobre nosotros. Mucho sobre hacerte la vida más fácil.
        </p>
      </LandingSection>

      <LandingSection background={brand.white} className="!py-[clamp(48px,6vw,80px)]">
        <h2 className="font-display text-[clamp(26px,3.2vw,38px)] font-extrabold leading-tight tracking-[-0.03em] text-[#123B7A]">
          La conveniencia no debería estar a 20 minutos en carro
        </h2>
        <p className="mt-[18px] max-w-[70ch] text-[17px] leading-relaxed">
          <strong className="text-[#123B7A]">Quick! Mini Market</strong> es una cadena de mini markets
          diseñada desde cero para comunidades residenciales. Abrimos tiendas dentro de los
          residenciales donde vive la gente, con los productos que se necesitan todos los días y un
          servicio que se mantiene consistente en cada una.
        </p>
      </LandingSection>

      <LandingSection background={brand.cream}>
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <h2 className="font-display text-[clamp(24px,2.8vw,30px)] font-extrabold leading-tight tracking-[-0.03em] text-[#123B7A]">
              Hecho para la vida diaria. Aquí mismo.
            </h2>
            <p className="mb-3 mt-4 text-base leading-relaxed">
              Estamos enfocados en crear valor económico y social mientras entregamos una experiencia
              de conveniencia moderna en los vecindarios donde tenemos presencia, y en llevarla a más
              comunidades del área de Bávaro y Verón.
            </p>
            <p className="text-base leading-relaxed">
              Cada tienda está diseñada para apoyar las necesidades del día a día — ofreciendo
              productos de calidad, empleos locales y una contribución positiva a las comunidades que
              nos reciben.
            </p>
          </div>
          <PhotoCard className="h-[clamp(300px,34vw,410px)] self-stretch">
            <Image
              src="/images/quienes-somos-tienda.jpg"
              alt="Interior de una tienda Quick! Mini Market"
              fill
              unoptimized
              className="object-cover"
              sizes="(min-width: 768px) 520px, 100vw"
            />
          </PhotoCard>
        </div>
      </LandingSection>

      <LandingSection background={brand.white}>
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <PhotoCard className="h-[clamp(300px,34vw,410px)] self-stretch">
            <Image
              src="/images/quienes-somos-equipo.jpg"
              alt="Equipo de Quick! Mini Market"
              fill
              unoptimized
              className="object-cover object-[center_30%]"
              sizes="(min-width: 768px) 520px, 100vw"
            />
            <SpeechBubble tone="orange" className="left-[22px] top-[26px] max-w-[200px] px-5 py-[15px]">
              Personas que hacen la diferencia.
            </SpeechBubble>
          </PhotoCard>
          <div>
            <h3 className="mb-2.5 font-display text-[21px] font-extrabold text-[#123B7A]">Propósito</h3>
            <p className="mb-6 text-base leading-relaxed">
              Que nadie tenga que ir lejos por lo básico. Existimos para llevar conveniencia real a
              comunidades residenciales, con un servicio que se siente cercano y una operación que
              crece junto a los vecinos que nos reciben.
            </p>
            <h3 className="mb-3 font-display text-[21px] font-extrabold text-[#123B7A]">Valores</h3>
            <div className="grid gap-2.5 text-base leading-relaxed">
              <p>
                <strong className="text-[#123B7A]">Cercanía:</strong> abrimos donde vives, no donde es
                más fácil para nosotros.
              </p>
              <p>
                <strong className="text-[#123B7A]">Consistencia:</strong> calidad de cadena, trato de
                vecino.
              </p>
              <p>
                <strong className="text-[#123B7A]">Simplicidad:</strong> lo que necesitas, sin
                complicaciones.
              </p>
              <p>
                <strong className="text-[#123B7A]">Innovación:</strong> siempre buscando cómo hacer la
                experiencia más fácil para ti.
              </p>
            </div>
          </div>
        </div>
      </LandingSection>

      <LandingSection background={brand.cream}>
        <Eyebrow>Surtido Quick!</Eyebrow>
        <h2 className="mt-4 font-display text-[clamp(28px,3.6vw,44px)] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#123B7A]">
          Mini market de vida diaria, <Highlight>no de fin de semana</Highlight>
        </h2>
        <p className="mb-8 mt-4 max-w-[62ch] text-[17px] leading-relaxed">
          Lo del día a día, sin vueltas: las categorías y marcas que la gente ya busca, con el mismo
          surtido en cada tienda de la cadena.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ASSORTMENT.map((item) => (
            <article
              key={item.title}
              className="flex items-start gap-3 rounded-[18px] px-4 py-3.5"
              style={{ backgroundColor: item.background }}
            >
              <span
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[17px]"
                style={{ backgroundColor: item.color }}
              >
                {item.emoji}
              </span>
              <span>
                <span className="block font-display text-base font-extrabold text-[#123B7A]">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-snug">{item.text}</span>
              </span>
            </article>
          ))}
        </div>
      </LandingSection>

      <LandingSection background={brand.white} className="!pb-[clamp(56px,7vw,96px)]">
        <div className="mx-auto max-w-[820px]">
          <h2 className="mb-6 font-display text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.03em] text-[#123B7A]">
            Preguntas frecuentes
          </h2>
          <LandingFaq items={FAQ_ITEMS} />
        </div>
      </LandingSection>
    </main>
  );
}
