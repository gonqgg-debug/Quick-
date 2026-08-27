import Image from "next/image";
import { brand, quickCoinsLogoPublicPath, whatsappHref } from "@/lib/theme";
import { LandingInner } from "@/components/landing/LandingSection";

const ORANGE = brand.orange;
const CREAM = brand.cream;
const WHITE = brand.white;
const STROKE = 3;
const TILE = 48;

function OxxoTilePattern({ id }: { id: string }) {
  return (
    <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
      {/* Semicírculo naranja — borde izquierdo */}
      <path d={`M0 ${TILE / 2} A${TILE / 2} ${TILE / 2} 0 0 1 0 0 L0 ${TILE / 2} Z`} fill={ORANGE} />
      {/* Arco cream — superior */}
      <path
        d={`M${TILE * 0.15} ${TILE * 0.15} Q${TILE / 2} 0 ${TILE * 0.85} ${TILE * 0.15}`}
        fill="none"
        stroke={CREAM}
        strokeWidth={STROKE + 3}
        strokeLinecap="round"
      />
      {/* Círculo blanco */}
      <circle cx={TILE * 0.7} cy={TILE * 0.35} r={TILE * 0.13} fill={WHITE} stroke={ORANGE} strokeWidth={STROKE} />
      {/* U invertida naranja — inferior */}
      <path
        d={`M${TILE * 0.2} ${TILE * 0.85} Q${TILE / 2} ${TILE * 0.55} ${TILE * 0.8} ${TILE * 0.85}`}
        fill="none"
        stroke={ORANGE}
        strokeWidth={STROKE + 2}
        strokeLinecap="round"
      />
      {/* Punto cream */}
      <circle cx={TILE * 0.3} cy={TILE * 0.65} r={TILE * 0.09} fill={CREAM} />
    </pattern>
  );
}

function PatternStrip({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <OxxoTilePattern id="qc-oxxo-tile" />
      </defs>
      <rect width="100%" height="100%" fill="url(#qc-oxxo-tile)" />
    </svg>
  );
}

function QuickCoinsWordmark() {
  return (
    <div className="flex items-center gap-3 md:gap-4" aria-label="Quick!Coins, programa de lealtad">
      <Image
        src={quickCoinsLogoPublicPath}
        alt=""
        width={64}
        height={64}
        unoptimized
        className="h-12 w-12 shrink-0 md:h-14 md:w-14"
        aria-hidden
      />
      <div>
        <p className="font-display text-2xl font-extrabold leading-none text-white md:text-[1.75rem]">
          Quick!
          <span style={{ color: brand.cream }}>Coins</span>
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/85 md:text-xs">
          Programa de lealtad
        </p>
      </div>
    </div>
  );
}

const JOIN_MESSAGE = "Hola, quiero unirme a Quick!Coins";

export function QuickCoinsBanner() {
  const joinHref = `${whatsappHref()}?text=${encodeURIComponent(JOIN_MESSAGE)}`;

  return (
    <section
      id="quick-coins"
      className="relative scroll-mt-20 overflow-hidden md:scroll-mt-24"
      style={{ backgroundColor: brand.green }}
    >
      {/* Desktop — franja de patrón tileada al borde derecho */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[min(26%,200px)] md:block"
        aria-hidden="true"
      >
        <PatternStrip className="h-full w-full" />
      </div>

      <LandingInner className="relative z-10 py-10 md:py-12">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto] md:gap-10 lg:grid-cols-[1fr_auto_auto] lg:gap-12 lg:pr-4">
          {/* Copy */}
          <div className="max-w-2xl lg:max-w-none">
            <QuickCoinsWordmark />
            <h2 className="font-display mt-4 text-4xl font-extrabold uppercase leading-[0.9] tracking-tight md:mt-5 md:text-6xl lg:text-7xl">
              <span className="block text-white">Tus compras</span>
              <span className="block" style={{ color: brand.orange }}>
                valen más
              </span>
            </h2>
            <p className="mt-3 text-base font-medium text-white/90 md:mt-4 md:text-lg">
              Acumula recompensas con Quick!Coins.
            </p>
          </div>

          {/* CTA — centro-derecha en desktop */}
          <a
            href={joinHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-[0.1em] transition hover:brightness-105 md:self-center md:px-10 md:py-4 md:text-base lg:justify-self-end"
            style={{
              backgroundColor: brand.cream,
              color: brand.green,
              border: `2px dashed ${brand.orange}`,
            }}
          >
            Únete ya
          </a>

          {/* Spacer para reservar espacio del patrón en lg+ */}
          <div className="hidden lg:block lg:w-[min(22%,160px)]" aria-hidden="true" />
        </div>
      </LandingInner>

      {/* Mobile — cinta horizontal con el mismo tile */}
      <div className="pointer-events-none h-12 w-full md:hidden" aria-hidden="true">
        <PatternStrip className="h-full w-full" />
      </div>
    </section>
  );
}
