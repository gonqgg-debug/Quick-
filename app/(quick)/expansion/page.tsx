import type { Metadata } from "next";
import Link from "next/link";
import { ExpansionForm } from "@/components/landing/ExpansionForm";
import { ExpansionMapSection } from "@/components/landing/ExpansionMapSection";
import { Eyebrow, Highlight, IconCircle, LandingSection } from "@/components/landing/BrandUi";
import { brand } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Expansión | Quick! Mini Market",
  description:
    "¿Tu residencial tiene un espacio para Quick!? Hablemos. Traemos conveniencia a más comunidades.",
};

const SEEK_OPTIONS = [
  {
    num: "01",
    title: "Alquiler",
    text: "Local en residencial, plaza comercial o local independiente.",
    background: brand.paleGreen,
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#7EB341" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M4 21V5l7-2v18" />
        <path d="M11 9h9v12" />
        <path d="M14 13h3M14 17h3" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Compra",
    text: "Adquirir el espacio cuando el proyecto y la ubicación lo justifiquen.",
    background: brand.paleBlue,
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1F82C5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 4-3 5 4 4-3 5 4" />
        <path d="M3 11v4l6 4 4-3 3 2 5-4v-4" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Alianza",
    text: "Acuerdo con la administración o el desarrollador del residencial.",
    background: brand.paleOrange,
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#F79521" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19v-1a4.5 4.5 0 0 1 4.5-4.5h3A4.5 4.5 0 0 1 15 18v1" />
        <circle cx="17.5" cy="9" r="2.2" />
      </svg>
    ),
  },
] as const;

export default function ExpansionPage() {
  return (
    <main style={{ color: brand.body, backgroundColor: brand.cream }}>
      <LandingSection background={brand.cream}>
        <Eyebrow>Panorama de crecimiento</Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(34px,5vw,60px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#123B7A]">
          Nuestra ruta de <Highlight>expansión</Highlight>
        </h1>
        <p className="mt-5 max-w-[62ch] text-lg leading-relaxed">
          Llevamos conveniencia y bienestar más cerca de más comunidades del área de Bávaro y Verón,
          con el mismo estándar en cada sucursal.
        </p>
      </LandingSection>

      <LandingSection background={brand.white}>
        <h2 className="font-display text-[clamp(26px,3.2vw,38px)] font-extrabold leading-tight tracking-[-0.03em] text-[#123B7A]">
          Buscamos espacios donde ya vive la gente
        </h2>
        <p className="mb-8 mt-4 max-w-[70ch] text-[17px] leading-relaxed">
          Evaluamos de forma continua oportunidades para llevar conveniencia a más comunidades
          residenciales: locales bien ubicados, espacios dentro de residenciales y propuestas que
          encajen con nuestro plan de crecimiento a largo plazo.
        </p>
        <ExpansionMapSection />
        <p className="mt-4 text-sm text-[#4A5568]">
          Toca un residencial para acercar el mapa. Punto sólido: tienda abierta. Anillo: proyectada.
        </p>
      </LandingSection>

      <LandingSection background={brand.cream}>
        <Eyebrow>Qué buscamos</Eyebrow>
        <h2 className="mt-4 font-display text-[clamp(28px,3.6vw,44px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#123B7A]">
          Espacios que encajen con el <Highlight className="rounded-2xl px-4">modelo</Highlight>
        </h2>
        <p className="mb-8 mt-4 max-w-[60ch] text-[17px] leading-relaxed">
          Tres formas de trabajar con propietarios, administraciones y desarrolladores.
        </p>
        <div className="grid gap-4">
          {SEEK_OPTIONS.map((item, index) => (
            <article
              key={item.title}
              className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-[18px] pb-4 ${
                index < SEEK_OPTIONS.length - 1 ? "border-b border-[#E7DCC8]" : ""
              }`}
            >
              <span className="font-display text-4xl font-extrabold leading-none text-[#F79521]">{item.num}</span>
              <IconCircle color={item.background} size={48}>
                {item.icon}
              </IconCircle>
              <span>
                <span className="block font-display text-[22px] font-extrabold text-[#123B7A]">{item.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed">{item.text}</span>
              </span>
            </article>
          ))}
        </div>
      </LandingSection>

      <LandingSection background={brand.white} className="!pb-[clamp(56px,7vw,96px)]">
        <div className="mx-auto max-w-[820px]">
          <h2 className="font-display text-[clamp(26px,3.4vw,40px)] font-extrabold leading-tight tracking-[-0.03em] text-[#123B7A]">
            ¿Tu residencial tiene un espacio para Quick!? Hablemos.
          </h2>
          <p className="mb-7 mt-3.5 text-[17px] leading-relaxed">
            Cuéntanos del espacio: nombre del residencial, ubicación, tamaño, visibilidad, parqueo y
            cualquier restricción conocida. Te contactamos con una propuesta.
          </p>
          <ExpansionForm />
          <p className="mt-6 text-sm">
            También puedes revisar la{" "}
            <Link href="/propuesta" className="font-bold text-[#1F82C5] hover:text-[#7EB341]">
              propuesta comercial
            </Link>
            .
          </p>
        </div>
      </LandingSection>
    </main>
  );
}
