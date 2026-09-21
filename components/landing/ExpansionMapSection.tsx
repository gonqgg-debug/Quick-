"use client";

import { useState } from "react";
import { ExpansionMap } from "@/components/propuesta/ExpansionMap";
import { EXPANSION_SITES } from "@/lib/expansion-sites";
import { brand } from "@/lib/theme";

function PinIcon({ color }: { color: string }) {
  return (
    <span
      className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.6" />
      </svg>
    </span>
  );
}

export function ExpansionMapSection() {
  const [focusId, setFocusId] = useState<string | null>(null);

  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      <div className="expansion-map-frame">
        <ExpansionMap scrollWheelZoom focusId={focusId} />
      </div>
      <div className="grid max-h-none gap-2.5 md:max-h-[min(560px,70vw)] md:overflow-y-auto md:pr-1">
        {EXPANSION_SITES.map((site) => {
          const selected = focusId === site.id;
          const color = site.brand === "pharmaquick" ? brand.blue : brand.green;
          const background = site.brand === "pharmaquick" ? brand.paleBlue : brand.paleGreen;
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => setFocusId(site.id)}
              className="flex items-center gap-3 rounded-[18px] px-[18px] py-4 text-left transition"
              style={{
                backgroundColor: background,
                boxShadow: selected ? `0 0 0 2px ${color}` : "none",
              }}
            >
              <PinIcon color={color} />
              <span>
                <span className="block font-display text-[17px] font-extrabold leading-tight text-[#123B7A]">
                  {site.name}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-[#4A5568]">{site.landingLine}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
