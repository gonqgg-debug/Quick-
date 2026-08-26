import { brand } from "@/lib/theme";

const ORANGE = brand.orange;
const GREEN = brand.green;
const WHITE = brand.white;
const STROKE = 5;

function DiagonalHatch({
  x,
  y,
  width,
  height,
  color = ORANGE,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}) {
  const id = `hatch-${x}-${y}`;
  return (
    <>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="2.5" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id})`} />
    </>
  );
}

export function HeroIllustrations({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 520 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ground line */}
      <path
        d="M40 360 H480"
        stroke={ORANGE}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />

      {/* Soda can — left */}
      <g transform="translate(30, 130)">
        <rect x="8" y="20" width="56" height="110" rx="6" fill={GREEN} stroke={ORANGE} strokeWidth={STROKE} />
        <rect x="8" y="20" width="56" height="28" rx="6" fill={ORANGE} stroke={ORANGE} strokeWidth={STROKE} />
        <ellipse cx="36" cy="20" rx="28" ry="8" fill={WHITE} stroke={ORANGE} strokeWidth={STROKE} />
        <path d="M18 60 H54" stroke={WHITE} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
        <path d="M18 78 H54" stroke={WHITE} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      </g>

      {/* Water bottle — center-left */}
      <g transform="translate(110, 95)">
        <rect x="22" y="48" width="36" height="120" rx="8" fill={WHITE} stroke={ORANGE} strokeWidth={STROKE} />
        <rect x="28" y="12" width="24" height="40" rx="4" fill={WHITE} stroke={ORANGE} strokeWidth={STROKE} />
        <rect x="32" y="4" width="16" height="12" rx="3" fill={ORANGE} stroke={ORANGE} strokeWidth={STROKE} />
        <DiagonalHatch x={28} y={70} width={24} height={70} color={ORANGE} />
        <path d="M30 58 H50" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Pretzel / snack ring — front center */}
      <g transform="translate(195, 210)">
        <ellipse cx="50" cy="55" rx="48" ry="38" fill={ORANGE} stroke={ORANGE} strokeWidth={STROKE} />
        <ellipse cx="50" cy="55" rx="22" ry="16" fill="#FFF6E8" stroke={ORANGE} strokeWidth={STROKE} />
        <path
          d="M20 40 Q50 10 80 40 Q50 70 20 40"
          stroke={WHITE}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Apple / fruit — right */}
      <g transform="translate(300, 175)">
        <circle cx="42" cy="52" r="38" fill={GREEN} stroke={ORANGE} strokeWidth={STROKE} />
        <path d="M42 14 Q48 4 58 8" stroke={ORANGE} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
        <ellipse cx="58" cy="18" rx="10" ry="6" fill={ORANGE} stroke={ORANGE} strokeWidth="3" transform="rotate(-25 58 18)" />
        <path d="M28 48 Q42 62 56 48" stroke={WHITE} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85" />
      </g>

      {/* Pizza slice — back right */}
      <g transform="translate(355, 120) rotate(8 60 80)">
        <path
          d="M20 140 L100 140 Q60 20 20 140 Z"
          fill={ORANGE}
          stroke={ORANGE}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
        <circle cx="55" cy="105" r="7" fill={WHITE} stroke={ORANGE} strokeWidth="3" />
        <circle cx="72" cy="88" r="6" fill={GREEN} stroke={ORANGE} strokeWidth="3" />
        <circle cx="45" cy="82" r="5" fill={WHITE} stroke={ORANGE} strokeWidth="3" />
        <DiagonalHatch x={35} y={95} width={40} height={35} color={WHITE} />
      </g>

      {/* Snack bag / chip bag — back left */}
      <g transform="translate(165, 55) rotate(-6 40 50)">
        <path
          d="M10 100 L70 100 L58 20 L22 20 Z"
          fill={WHITE}
          stroke={ORANGE}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
        <path d="M22 20 L36 8 L54 8 L58 20" fill={ORANGE} stroke={ORANGE} strokeWidth={STROKE} strokeLinejoin="round" />
        <DiagonalHatch x={24} y={45} width={32} height={40} color={GREEN} />
        <circle cx="40" cy="68" r="10" fill={GREEN} stroke={ORANGE} strokeWidth="3" />
      </g>
    </svg>
  );
}
