import { Badge } from "@/components/brand/Badge";
import { Logo } from "@/components/brand/Logo";
import { brand, whatsappHref } from "@/lib/theme";

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

function IconShoppingCart({ className = "" }: { className?: string }) {
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
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function IconHome({ className = "" }: { className?: string }) {
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
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function IconHeart({ className = "" }: { className?: string }) {
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
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconMapPin({ className = "" }: { className?: string }) {
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
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Escríbenos por WhatsApp",
    text: "Inicia un chat, no necesitas app ni registro.",
    Icon: IconMessageCircle,
  },
  {
    n: "2",
    title: "Arma tu pedido",
    text: "Elige del catálogo completo lo que necesitas.",
    Icon: IconShoppingCart,
  },
  {
    n: "3",
    title: "Te llega a la puerta",
    text: "Recibe todo directo en tu residencial.",
    Icon: IconHome,
  },
];

function WhatsAppButton({ className = "", small = false }: { className?: string; small?: boolean }) {
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold text-white ${
        small ? "px-5 py-2.5 text-sm" : "min-h-12 px-7 py-3.5 text-base"
      } ${className}`}
      style={{ backgroundColor: brand.green }}
    >
      <IconMessageCircle className={small ? "h-4 w-4" : "h-5 w-5"} />
      Pedir por WhatsApp
    </a>
  );
}

function DeliveryTrailHero() {
  return (
    <svg
      className="pointer-events-none absolute -left-8 -top-2 h-28 w-40 sm:-left-12 sm:h-32 sm:w-48"
      viewBox="0 0 180 120"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 90 C 40 20, 100 10, 170 50"
        stroke={brand.orange}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

function DeliveryTrailSteps() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 900 200"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M50 160 C 150 40, 250 180, 450 100 S 650 20, 750 140 S 850 100, 850 100"
        stroke={brand.orange}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
        strokeDasharray="8 6"
      />
    </svg>
  );
}

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <main className="bg-white" style={{ color: brand.ink }}>
      <div className="mx-auto max-w-[1100px] px-6 md:px-8">
        {/* Hero */}
        <section className="pb-12 pt-8 md:pb-16 md:pt-12">
          <div className="mx-auto max-w-2xl text-center">
            <div className="relative mx-auto inline-block">
              <DeliveryTrailHero />
              <Logo className="relative z-10 mx-auto h-16 max-w-[220px] md:h-20 md:max-w-[280px]" />
            </div>
            <h1 className="font-display mt-6 text-balance text-3xl font-extrabold leading-tight md:mt-8 md:text-5xl">
              La conveniencia de tu residencial, todos los días
            </h1>
            <p
              className="mx-auto mt-3 max-w-md text-base leading-relaxed md:mt-4 md:text-lg"
              style={{ color: brand.muted }}
            >
              Quick! Mini Market lleva lo que necesitas directo a tu comunidad — sin salir del
              residencial.
            </p>
            <div className="mt-6 md:mt-8">
              <WhatsAppButton />
            </div>
          </div>
        </section>

        {/* Quiénes somos */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-2xl">
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: brand.orange }}
            >
              Quiénes somos
            </p>
            <h2 className="font-display mt-2 text-3xl font-bold leading-tight md:text-4xl">
              Una tienda pensada para tu comunidad
            </h2>
            <p
              className="mt-5 text-base leading-relaxed md:text-lg"
              style={{ color: brand.muted }}
            >
              Quick! Mini Market es una cadena de mini markets enfocada en comunidades residenciales.
              Nuestro objetivo es simple: traer conveniencia y buen servicio directo a donde vives,
              con la calidad y consistencia de una cadena, pero la cercanía de tu vecino de al lado.
              Abrimos nuestra primera tienda en septiembre de 2025, y desde entonces trabajamos para
              que hacer las compras del día a día sea más fácil para cada residencial donde estamos.
            </p>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-4xl">
            <p
              className="text-center text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: brand.orange }}
            >
              Cómo funciona
            </p>
            <h2 className="font-display mt-2 text-center text-3xl font-bold md:text-4xl">
              Pedir es así de simple
            </h2>
            <div className="relative mt-10">
              <div className="hidden md:block">
                <DeliveryTrailSteps />
              </div>
              <ol className="relative z-10 grid gap-4 md:grid-cols-3 md:gap-6">
                {STEPS.map((step) => (
                  <li
                    key={step.n}
                    className="rounded-3xl bg-white px-6 py-7 shadow-[0_8px_30px_rgba(26,26,26,0.08)]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold text-white"
                        style={{ backgroundColor: brand.green }}
                      >
                        {step.n}
                      </span>
                      <step.Icon className="h-6 w-6" style={{ color: brand.orange }} />
                    </div>
                    <h3 className="font-display mt-4 text-xl font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: brand.muted }}>
                      {step.text}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* PharmaQuick! */}
        <section className="py-20 md:py-28">
          <div
            className="mx-auto max-w-3xl rounded-3xl px-6 py-16 md:px-12 md:py-20"
            style={{ backgroundColor: "#EAF3FA" }}
          >
            <div className="flex items-center gap-2">
              <IconHeart className="h-5 w-5" style={{ color: brand.blue }} />
              <Badge variant="blue">Próximamente</Badge>
            </div>
            <h2 className="font-display mt-4 text-3xl font-bold md:text-4xl" style={{ color: brand.blue }}>
              PharmaQuick!
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: brand.ink }}>
              Muy pronto abrimos PharmaQuick!, nuestra farmacia hermana, cerca de Quick! — el mismo
              estándar de conveniencia y cercanía, ahora también para tu salud y cuidado personal.
            </p>
          </div>
        </section>

        {/* Ubicación */}
        <section className="py-20 md:py-28">
          <div
            className="mx-auto max-w-3xl rounded-3xl px-6 py-12 md:px-12 md:py-16"
            style={{ backgroundColor: "#F9FAFB" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: brand.orange }}
            >
              Ubicación
            </p>
            <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">Dónde estamos</h2>
            <p className="mt-5 text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
              Hoy tenemos una tienda en el Residencial Jardines 3, Pueblo Bávaro. Y vienen más —
              estamos creciendo hacia otros residenciales próximamente.
            </p>
            <div
              className="mt-6 flex items-start gap-3 rounded-2xl bg-white px-5 py-4"
              style={{ color: brand.ink }}
            >
              <IconMapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: brand.green }} />
              <span className="font-semibold leading-relaxed">
                Residencial Jardines 3, Pueblo Bávaro, La Altagracia, República Dominicana
              </span>
            </div>
            {/* Aquí se puede insertar un mapa embebido de Google Maps más adelante. */}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 pb-12 pt-10">
          <div className="flex flex-col items-center gap-5 text-center">
            <Logo className="h-10 max-w-[160px]" />
            <WhatsAppButton small />
            <p className="text-sm" style={{ color: brand.muted }}>
              © {year} Quick! Mini Market
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
