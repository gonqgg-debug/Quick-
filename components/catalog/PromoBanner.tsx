import type { CatalogPromoBanner } from "@/lib/catalog-promo";
import { brand } from "@/lib/theme";

type PromoBannerProps = {
  banners?: CatalogPromoBanner[];
};

export function PromoBanner({ banners = [] }: PromoBannerProps) {
  const banner = banners[0] ?? null;
  if (!banner) {
    return null;
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
      <div className="relative flex min-h-[112px] items-center py-3 pl-4 pr-4 sm:min-h-[128px] sm:pl-5 sm:pr-5">
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
    </div>
  );
}
