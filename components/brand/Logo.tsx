"use client";

import { useState } from "react";
import { brand, logoPublicPath, pharmaLogoPublicPath } from "@/lib/theme";

type LogoProps = {
  className?: string;
  variant?: "market" | "pharma";
  onDark?: boolean;
};

export function Logo({ className = "", variant = "market", onDark = false }: LogoProps) {
  const [failed, setFailed] = useState(false);
  const src = variant === "pharma" ? pharmaLogoPublicPath : logoPublicPath;

  if (failed) {
    return <Wordmark variant={variant} onDark={onDark} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={variant === "pharma" ? "PharmaQuick!" : "Quick! Mini Market"}
      className={`w-auto object-contain object-left ${
        onDark ? "brightness-0 invert" : ""
      } ${className || "h-16 max-w-[280px]"}`}
      onError={() => setFailed(true)}
    />
  );
}

export function Wordmark({
  variant = "market",
  className = "",
  onDark = false,
}: {
  variant?: "market" | "pharma";
  className?: string;
  onDark?: boolean;
}) {
  if (variant === "pharma") {
    return (
      <p className={`font-display text-2xl font-bold leading-none ${className}`}>
        <span style={{ color: onDark ? "#FFFFFF" : brand.blue }}>Pharma</span>
        <span style={{ color: onDark ? "#FFFFFF" : brand.ink }}>Quick!</span>
      </p>
    );
  }

  return (
    <p className={`font-display leading-none ${className}`}>
      <span className="block text-3xl font-bold" style={{ color: onDark ? "#FFFFFF" : brand.green }}>
        Quick!
      </span>
      <span
        className="mt-0.5 block text-sm font-bold tracking-wide"
        style={{ color: onDark ? "#FFFFFF" : brand.blue }}
      >
        Mini Market
      </span>
    </p>
  );
}
