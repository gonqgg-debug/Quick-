"use client";

import { useEffect, useState } from "react";
import {
  CATALOG_PROMO_STORAGE_PREFIX,
  type CatalogPromoBanner,
} from "@/lib/catalog-promo";
import { brand } from "@/lib/theme";

type PromoBannerProps = {
  banners?: CatalogPromoBanner[];
  storage?: "local" | "session";
};

function storageKey(id: string): string {
  return `${CATALOG_PROMO_STORAGE_PREFIX}${id}`;
}

export function PromoBanner({ banners = [], storage = "local" }: PromoBannerProps) {
  const banner = banners[0] ?? null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!banner) {
      return;
    }
    const store = storage === "session" ? window.sessionStorage : window.localStorage;
    setVisible(store.getItem(storageKey(banner.id)) !== "1");
  }, [banner, storage]);

  if (!banner || !visible) {
    return null;
  }

  function dismiss() {
    if (!banner) {
      return;
    }
    const store = storage === "session" ? window.sessionStorage : window.localStorage;
    store.setItem(storageKey(banner.id), "1");
    setVisible(false);
  }

  return (
    <div className="relative mt-3 overflow-hidden rounded-[22px] text-white" style={{ minHeight: 112 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.imageSrc}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: banner.imagePosition ?? "center" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(26,26,26,0.88) 0%, rgba(26,26,26,0.62) 48%, rgba(26,26,26,0.18) 100%)",
        }}
      />
      <div className="relative flex min-h-[112px] items-center py-3 pl-4 pr-11 sm:min-h-[128px] sm:pl-5">
        <div className="max-w-[70%]">
          {banner.eyebrow ? (
            <p
              className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: brand.orange }}
            >
              {banner.eyebrow}
            </p>
          ) : null}
          <p className="font-display mt-0.5 text-lg font-bold leading-snug sm:text-xl">{banner.title}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(26,26,26,0.45)" }}
        aria-label="Cerrar promoción"
      >
        <span className="text-lg leading-none" aria-hidden>
          ×
        </span>
      </button>
    </div>
  );
}
