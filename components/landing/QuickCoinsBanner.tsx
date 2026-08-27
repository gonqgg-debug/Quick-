import { brand, whatsappHref } from "@/lib/theme";
import { LandingInner, SectionWave } from "@/components/landing/LandingSection";

const ORANGE = brand.orange;
const CREAM = brand.cream;
const WHITE = brand.white;
const STROKE = 4;

function DiagonalHatch({
  id,
  color = ORANGE,
}: {
  id: string;
  color?: string;
}) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="2.5" />
    </pattern>
  );
}

function QuickCoinsWordmark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 280 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Quick!Coins"
      role="img"
    >
      <defs>
        <DiagonalHatch id="qc-coin-hatch" color={ORANGE} />
      </defs>
      {/* Back coin */}
      <circle cx="22" cy="26" r="18" fill={CREAM} stroke={ORANGE} strokeWidth={STROKE} />
      <circle cx="22" cy="26" r="10" fill={`url(#qc-coin-hatch)`} opacity="0.35" />
      {/* Front coin */}
      <circle cx="38" cy="26" r="18" fill={ORANGE} stroke={CREAM} strokeWidth={STROKE} />
      <text
        x="38"
        y="30"
        textAnchor="middle"
        fill={WHITE}
        fontSize="14"
        fontWeight="800"
        fontFamily="var(--font-brand-display), system-ui, sans-serif"
      >
        Q
      </text>
      {/* Wordmark */}
      <text
        x="68"
        y="24"
        fill={WHITE}
        fontSize="26"
        fontWeight="800"
        fontFamily="var(--font-brand-display), system-ui, sans-serif"
      >
        Quick!
        <tspan fill={CREAM}>Coins</tspan>
      </text>
      <text
        x="68"
        y="44"
        fill={WHITE}
        fillOpacity="0.85"
        fontSize="9"
        fontWeight="700"
        letterSpacing="0.22em"
        fontFamily="var(--font-brand-body), system-ui, sans-serif"
      >
        PROGRAMA DE LEALTAD
      </text>
    </svg>
  );
}

function QuickCoinsPattern({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMaxYMid slice"
    >
      <defs>
        <DiagonalHatch id="qc-pattern-hatch" color={ORANGE} />
        <DiagonalHatch id="qc-pattern-hatch-cream" color={CREAM} />
      </defs>
      {/* Row 1 */}
      <circle cx="60" cy="28" r="22" fill={ORANGE} stroke={CREAM} strokeWidth={STROKE} />
      <circle cx="38" cy="28" r="14" fill={CREAM} stroke={ORANGE} strokeWidth="3" />
      <circle cx="82" cy="28" r="14" fill={WHITE} stroke={ORANGE} strokeWidth="3" />
      {/* Row 2 — interlocking */}
      <path
        d="M30 72 C30 52 50 52 60 62 C70 52 90 52 90 72 C90 92 70 92 60 82 C50 92 30 92 30 72 Z"
        fill={CREAM}
        stroke={ORANGE}
        strokeWidth={STROKE}
      />
      <rect x="48" y="58" width="24" height="28" fill={`url(#qc-pattern-hatch)`} opacity="0.4" />
      {/* Row 3 */}
      <circle cx="60" cy="128" r="24" fill={WHITE} stroke={ORANGE} strokeWidth={STROKE} />
      <circle cx="60" cy="128" r="14" fill={`url(#qc-pattern-hatch-cream)`} opacity="0.5" />
      <circle cx="36" cy="118" r="12" fill={ORANGE} stroke={CREAM} strokeWidth="3" />
      <circle cx="84" cy="138" r="12" fill={ORANGE} stroke={CREAM} strokeWidth="3" />
      {/* Row 4 */}
      <path
        d="M28 168 C28 148 48 148 60 158 C72 148 92 148 92 168 C92 188 72 188 60 178 C48 188 28 188 28 168 Z"
        fill={ORANGE}
        stroke={CREAM}
        strokeWidth={STROKE}
      />
      {/* Row 5 */}
      <circle cx="60" cy="224" r="22" fill={CREAM} stroke={ORANGE} strokeWidth={STROKE} />
      <circle cx="42" cy="224" r="10" fill={ORANGE} stroke={WHITE} strokeWidth="2" />
      <circle cx="78" cy="224" r="10" fill={ORANGE} stroke={WHITE} strokeWidth="2" />
      {/* Row 6 */}
      <circle cx="60" cy="278" r="24" fill={ORANGE} stroke={CREAM} strokeWidth={STROKE} />
      <circle cx="60" cy="278" r="12" fill={WHITE} stroke={ORANGE} strokeWidth="3" />
    </svg>
  );
}

function QuickCoinsPatternStrip({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <DiagonalHatch id="qc-strip-hatch" color={ORANGE} />
      </defs>
      {Array.from({ length: 8 }).map((_, i) => {
        const x = 24 + i * 48;
        const fill = i % 3 === 0 ? ORANGE : i % 3 === 1 ? CREAM : WHITE;
        return (
          <circle
            key={i}
            cx={x}
            cy="24"
            r="16"
            fill={fill}
            stroke={ORANGE}
            strokeWidth="3"
          />
        );
      })}
      <circle cx="200" cy="24" r="10" fill={`url(#qc-strip-hatch)`} opacity="0.35" />
    </svg>
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
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[min(22%,140px)] md:block lg:w-[min(22%,180px)]"
        aria-hidden="true"
      >
        <QuickCoinsPattern className="h-full w-full" />
      </div>

      <LandingInner className="relative z-10 py-10 md:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between md:gap-10 lg:pr-[min(18%,160px)]">
          <div className="max-w-2xl">
            <QuickCoinsWordmark className="h-11 w-auto max-w-[260px] md:h-12 md:max-w-[280px]" />
            <h2 className="font-display mt-4 text-4xl font-extrabold uppercase leading-[0.92] tracking-tight md:mt-5 md:text-6xl lg:text-7xl">
              <span className="block text-white">Tus compras</span>
              <span className="block" style={{ color: brand.cream }}>
                valen más
              </span>
            </h2>
            <p className="mt-3 text-base font-medium text-white/90 md:mt-4 md:text-lg">
              Acumula recompensas con Quick!Coins.
            </p>
          </div>

          <a
            href={joinHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-[0.1em] transition hover:brightness-105 md:self-center md:px-10 md:py-4 md:text-base"
            style={{
              backgroundColor: brand.cream,
              color: brand.green,
              border: `2px dashed ${brand.orange}`,
            }}
          >
            Únete ya
          </a>
        </div>
      </LandingInner>

      <div className="pointer-events-none h-10 w-full overflow-hidden opacity-90 md:hidden" aria-hidden="true">
        <QuickCoinsPatternStrip className="h-full w-full" />
      </div>

      <SectionWave fill="#F1F7EA" />
    </section>
  );
}
