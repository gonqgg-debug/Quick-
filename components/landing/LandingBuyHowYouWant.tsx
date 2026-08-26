import { brand, whatsappHref } from "@/lib/theme";
import { LandingInner, SectionEyebrow, SectionWave } from "@/components/landing/LandingSection";

function IconStore({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconMessageCircle({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

const CHANNELS = [
  {
    id: "tienda",
    title: "En tienda",
    text: "Pasas por el pasillo, eliges lo que necesitas y te lo llevas. Residencial Jardines 3, todos los días de 8:00 a. m. a 12:00 a. m.",
    Icon: IconStore,
    accent: brand.blue,
    cta: { href: "#donde-estamos", label: "Ver ubicación" },
  },
  {
    id: "whatsapp",
    title: "Por WhatsApp",
    text: "Escríbenos, te abrimos el catálogo con fotos y precios, y te lo llevamos a tu apartamento. Sin app ni registro.",
    Icon: IconMessageCircle,
    accent: brand.green,
    cta: { href: "#catalogo", label: "Ver cómo se pide" },
    secondaryCta: { href: whatsappHref(), label: "Pedir por WhatsApp", external: true },
  },
] as const;

export function LandingBuyHowYouWant() {
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-white pt-20 md:scroll-mt-24 md:pt-28">
      <LandingInner className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl">
          <SectionEyebrow centered>Cómo comprar</SectionEyebrow>
          <h2 className="font-display mt-3 text-center text-4xl font-extrabold md:text-5xl">
            Compra como quieras
          </h2>
          <p
            className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed md:text-lg"
            style={{ color: brand.muted }}
          >
            Mucha gente pasa a la tienda. Si prefieres no salir, pide por WhatsApp y te lo llevamos a
            la puerta.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {CHANNELS.map((channel) => (
              <article
                key={channel.id}
                className="flex h-full flex-col rounded-3xl bg-white px-6 py-7 shadow-[0_8px_30px_rgba(26,26,26,0.08)]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: channel.accent }}
                  >
                    <channel.Icon className="h-6 w-6" />
                  </span>
                  <h3 className="font-display text-2xl font-bold">{channel.title}</h3>
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed md:text-base" style={{ color: brand.muted }}>
                  {channel.text}
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href={channel.cta.href}
                    className="inline-flex min-h-11 items-center justify-center rounded-full px-6 py-2.5 text-sm font-bold text-white"
                    style={{ backgroundColor: channel.accent }}
                  >
                    {channel.cta.label}
                  </a>
                  {"secondaryCta" in channel && channel.secondaryCta ? (
                    <a
                      href={channel.secondaryCta.href}
                      target={channel.secondaryCta.external ? "_blank" : undefined}
                      rel={channel.secondaryCta.external ? "noopener noreferrer" : undefined}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border-2 px-6 py-2.5 text-sm font-bold"
                      style={{ borderColor: brand.green, color: brand.green }}
                    >
                      {channel.secondaryCta.label}
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </LandingInner>
      <SectionWave fill="#F1F7EA" />
    </section>
  );
}
