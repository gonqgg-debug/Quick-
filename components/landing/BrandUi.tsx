import Link from "next/link";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { brand } from "@/lib/theme";

export function LandingSection({
  children,
  className = "",
  background = brand.cream,
  id,
}: {
  children: ReactNode;
  className?: string;
  background?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`px-6 py-[clamp(56px,7vw,96px)] md:px-8 ${className}`}
      style={{ backgroundColor: background }}
    >
      <div className="mx-auto max-w-[1100px]">{children}</div>
    </section>
  );
}

export function Highlight({
  children,
  className = "",
  color = "#7EB341",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={`inline-block rounded-[18px] px-5 py-0.5 text-white ${className}`}
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#FDE9C8] px-[18px] py-[7px] text-xs font-bold uppercase tracking-[0.18em] text-[#123B7A]">
      {children}
    </span>
  );
}

export function SpeechBubble({
  children,
  tone = "blue",
  className = "",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "cream" | "orange";
  className?: string;
}) {
  const tones: Record<string, { background: string; color: string }> = {
    blue: { background: brand.blue, color: "#fff" },
    green: { background: brand.green, color: "#fff" },
    cream: { background: "#FDE9C8", color: "#123B7A" },
    orange: { background: brand.orange, color: "#fff" },
  };
  const colors = tones[tone];

  return (
    <span
      className={`absolute font-hand text-[25px] font-bold leading-[1.15] shadow-[0_12px_28px_rgba(26,26,26,0.2)] ${className}`}
      style={{
        borderRadius: "34px 34px 34px 8px",
        background: colors.background,
        color: colors.color,
      }}
    >
      {children}
    </span>
  );
}

export function PhotoCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl shadow-[0_18px_44px_rgba(26,26,26,0.12)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

const BUTTON_VARIANTS: Record<string, string> = {
  green: "bg-[#7EB341] text-white hover:brightness-95",
  orange: "bg-[#F79521] text-white hover:brightness-95",
  blue: "bg-[#1F82C5] text-white hover:brightness-95",
  outline: "border-2 border-[#7EB341] bg-transparent text-[#7EB341] hover:bg-[#7EB341]/10",
};

const BUTTON_SIZES: Record<string, string> = {
  sm: "min-h-9 px-5 text-sm",
  lg: "min-h-12 px-7 text-base",
};

type BrandButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "green" | "orange" | "blue" | "outline";
  size?: "sm" | "lg";
  className?: string;
  uppercase?: boolean;
  onClick?: () => void;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
};

export function BrandButton({
  children,
  href,
  variant = "green",
  size = "lg",
  className = "",
  uppercase = false,
  onClick,
  type = "button",
}: BrandButtonProps) {
  const classes = `inline-flex items-center justify-center rounded-full font-bold transition ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${uppercase ? "uppercase tracking-[0.04em]" : ""} ${className}`;

  if (href) {
    const external = href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");
    if (external) {
      return (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick}>
      {children}
    </button>
  );
}

export function IconCircle({
  children,
  color,
  size = 46,
}: {
  children: ReactNode;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: color, height: size, width: size }}
    >
      {children}
    </span>
  );
}
