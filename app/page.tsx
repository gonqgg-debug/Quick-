import { Badge } from "@/components/brand/Badge";
import { Logo } from "@/components/brand/Logo";
import { brand, whatsappHref } from "@/lib/theme";

const STEPS = [
  {
    n: "1",
    title: "Escríbenos por WhatsApp",
    text: "Inicia un chat, no necesitas app ni registro.",
  },
  {
    n: "2",
    title: "Arma tu pedido",
    text: "Elige del catálogo completo lo que necesitas.",
  },
  {
    n: "3",
    title: "Te llega a la puerta",
    text: "Recibe todo directo en tu residencial.",
  },
];

function WhatsAppButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-7 py-3.5 text-base font-bold text-white ${className}`}
      style={{ backgroundColor: brand.green }}
    >
      Pedir por WhatsApp
    </a>
  );
}

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <main className="bg-white" style={{ color: brand.ink }}>
      <section className="px-5 pb-16 pt-10 md:pb-24 md:pt-16">
        <div className="mx-auto max-w-lg text-center md:max-w-2xl">
          <div className="relative mx-auto inline-block">
            <svg
              className="pointer-events-none absolute -left-6 top-6 hidden h-10 w-24 sm:block"
              viewBox="0 0 120 40"
              fill="none"
              aria-hidden="true"
            >
              <path
                className="cart-trail"
                d="M4 28 C 28 8, 62 6, 116 18"
                stroke={brand.orange}
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <Logo className="mx-auto h-20 max-w-[260px] md:h-24 md:max-w-[320px]" />
          </div>
          <h1 className="font-display mt-8 text-balance text-4xl font-extrabold leading-tight md:text-5xl">
            La conveniencia de tu residencial, todos los días
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
            Quick! Mini Market lleva lo que necesitas directo a tu comunidad — sin salir del
            residencial.
          </p>
          <div className="mt-8">
            <WhatsAppButton />
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-lg md:max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: brand.orange }}>
            Quiénes somos
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold leading-tight md:text-4xl">
            Una tienda pensada para tu comunidad
          </h2>
          <p className="mt-5 text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
            Quick! Mini Market es una cadena de mini markets enfocada en comunidades residenciales.
            Nuestro objetivo es simple: traer conveniencia y buen servicio directo a donde vives, con
            la calidad y consistencia de una cadena, pero la cercanía de tu vecino de al lado. Abrimos
            nuestra primera tienda en septiembre de 2025, y desde entonces trabajamos para que hacer
            las compras del día a día sea más fácil para cada residencial donde estamos.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:py-24" style={{ backgroundColor: "#F8FAF7" }}>
        <div className="mx-auto max-w-lg md:max-w-4xl">
          <p className="text-center text-xs font-bold uppercase tracking-[0.18em]" style={{ color: brand.orange }}>
            Cómo funciona
          </p>
          <h2 className="font-display mt-2 text-center text-3xl font-bold md:text-4xl">
            Pedir es así de simple
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="rounded-[28px] bg-white px-5 py-6 shadow-[0_10px_28px_rgba(26,26,26,0.06)]"
              >
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full font-display text-xl font-extrabold text-white"
                  style={{ backgroundColor: brand.green }}
                >
                  {step.n}
                </span>
                <h3 className="font-display mt-4 text-xl font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: brand.muted }}>
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 py-16 text-white md:py-24" style={{ backgroundColor: brand.blue }}>
        <div className="mx-auto max-w-lg md:max-w-2xl">
          <Logo variant="pharma" onDark className="h-14 max-w-[240px]" />
          <div className="mt-4">
            <Badge variant="blue">Próximamente</Badge>
          </div>
          <h2 className="font-display mt-4 text-3xl font-bold md:text-4xl">PharmaQuick!</h2>
          <p className="mt-4 text-base leading-relaxed text-white/90 md:text-lg">
            Muy pronto abrimos PharmaQuick!, nuestra farmacia hermana, cerca de Quick! — el mismo
            estándar de conveniencia y cercanía, ahora también para tu salud y cuidado personal.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-lg md:max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: brand.orange }}>
            Ubicación
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">Dónde estamos</h2>
          <p className="mt-5 text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
            Hoy tenemos una tienda en el Residencial Jardines 3, Pueblo Bávaro. Y vienen más —
            estamos creciendo hacia otros residenciales próximamente.
          </p>
          <p className="mt-6 rounded-[28px] px-5 py-5 font-semibold leading-relaxed" style={{ backgroundColor: "#F8FAF7" }}>
            Residencial Jardines 3, Pueblo Bávaro, La Altagracia, República Dominicana
          </p>
          {/* Aquí se puede insertar un mapa embebido de Google Maps más adelante. */}
        </div>
      </section>

      <footer className="px-5 pb-12 pt-8">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center md:max-w-2xl">
          <Logo className="h-12 max-w-[200px]" />
          <WhatsAppButton />
          <p className="text-sm" style={{ color: brand.muted }}>
            © {year} Quick! Mini Market
          </p>
        </div>
      </footer>
    </main>
  );
}
