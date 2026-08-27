import Image from "next/image";
import { brand, quickCoinsLogoPublicPath, whatsappHref } from "@/lib/theme";
import { LandingInner } from "@/components/landing/LandingSection";

const ORANGE = brand.orange;

function IconCart({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-10 -6 h3 l3.5 11 h11 l2.2 -7 H-4" />
      <circle cx="-1" cy="8" r="1.6" />
      <circle cx="7" cy="8" r="1.6" />
    </g>
  );
}

function IconBasket({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-9 -5 h18 l-1.6 11 H-7.4 Z" />
      <path d="M-4 -5 v-2 a4 4 0 0 1 8 0 v2" />
    </g>
  );
}

function IconBag({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-7 -4 h14 l-1.4 14 H-5.6 Z" />
      <path d="M-3 -4 v-3 a3 3 0 0 1 6 0 v3" />
    </g>
  );
}

function IconMug({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-7 -4 h10 v8 a3.5 3.5 0 0 1 -3.5 3.5 H-3.5 A3.5 3.5 0 0 1 -7 4 Z" />
      <path d="M3 -1 h2.5 a2.4 2.4 0 0 1 0 5 H3" />
      <path d="M-5 -8 c1 -1.4 2.4 -1.4 2.4 0" />
      <path d="M-1.5 -8 c1 -1.4 2.4 -1.4 2.4 0" />
    </g>
  );
}

function IconCup({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-6 -3 h12 l-1.4 11 H-4.6 Z" />
      <path d="M-4 -3 v-3 h8 v3" />
      <path d="M-5.2 8 h10.4" />
    </g>
  );
}

function IconBurger({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-9 -1 h18 a8 5 0 0 0 -18 0 Z" />
      <path d="M-10 2 h20" />
      <path d="M-9 5 h18 a8 5 0 0 1 -18 0 Z" />
    </g>
  );
}

function IconSandwich({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-10 -2 h20 l-2 -3 H-8 Z" />
      <path d="M-10 1 h20" />
      <path d="M-10 4 h20 l-2 3 H-8 Z" />
    </g>
  );
}

function IconCroissant({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-9 4 C-5 -8, 6 -8, 10 2 C4 0, 0 2, -6 8" />
      <path d="M-4 0 Q0 -2 5 1" />
    </g>
  );
}

function IconTag({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <path d="M-8 -6 h8 l8 8 -8 8 -8 -8 Z" />
      <circle cx="-3" cy="-2" r="1.4" />
      <path d="M1 1 l5 5" />
    </g>
  );
}

function IconPercent({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none">
      <circle cx="-4" cy="-4" r="2.2" />
      <circle cx="4" cy="4" r="2.2" />
      <path d="M-5 6 L6 -5" />
    </g>
  );
}

function IconMosaic({ className = "" }: { className?: string }) {
  const stroke = { stroke: ORANGE, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <svg
      className={className}
      viewBox="0 0 180 420"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g {...stroke} opacity="0.9">
        <IconCart x={28} y={28} r={-18} />
        <IconMug x={92} y={22} r={12} />
        <IconBag x={150} y={48} r={-8} />
        <IconPercent x={48} y={78} r={22} />
        <IconBurger x={118} y={88} r={-14} />
        <IconBasket x={32} y={128} r={8} />
        <IconCup x={96} y={138} r={-22} />
        <IconTag x={154} y={122} r={16} />
        <IconCroissant x={58} y={182} r={-28} />
        <IconCart x={130} y={188} r={24} />
        <IconSandwich x={28} y={232} r={10} />
        <IconPercent x={88} y={228} r={-6} />
        <IconMug x={154} y={248} r={18} />
        <IconBag x={52} y={278} r={-16} />
        <IconBasket x={118} y={292} r={12} />
        <IconBurger x={28} y={328} r={-10} />
        <IconCup x={92} y={338} r={20} />
        <IconTag x={148} y={332} r={-20} />
        <IconCroissant x={44} y={382} r={14} />
        <IconCart x={120} y={392} r={-12} />
        <IconSandwich x={162} y={188} r={-30} />
        <IconPercent x={168} y={78} r={8} />
      </g>
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
        className="h-12 w-12 shrink-0 object-contain md:h-14 md:w-14"
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
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[min(28%,220px)] md:block"
        aria-hidden="true"
      >
        <IconMosaic className="h-full w-full" />
      </div>

      <LandingInner className="relative z-10 py-14 md:py-16">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto] md:gap-12 lg:grid-cols-[1fr_auto_auto] lg:gap-14 lg:pr-6">
          <div className="max-w-2xl lg:max-w-none">
            <QuickCoinsWordmark />
            <h2 className="font-display mt-5 text-4xl font-extrabold uppercase leading-[0.9] tracking-tight md:mt-6 md:text-6xl lg:text-7xl">
              <span className="block text-white">Tus compras</span>
              <span className="block" style={{ color: brand.orange }}>
                valen más
              </span>
            </h2>
            <p className="mt-4 text-base font-medium text-white/90 md:mt-5 md:text-lg">
              Acumula recompensas con Quick!Coins.
            </p>
          </div>

          <a
            href={joinHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-105 md:self-center md:px-10 md:py-4 md:text-base lg:justify-self-end"
            style={{ backgroundColor: brand.orange }}
          >
            Únete ya
          </a>

          <div className="hidden lg:block lg:w-[min(24%,180px)]" aria-hidden="true" />
        </div>
      </LandingInner>

      <div className="pointer-events-none h-16 w-full overflow-hidden md:hidden" aria-hidden="true">
        <IconMosaic className="h-full w-full" />
      </div>
    </section>
  );
}
