export type CatalogPromoBanner = {
  id: string;
  eyebrow?: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  /** CSS object-position for how the photo is cropped in the wide banner. */
  imagePosition?: string;
};

/**
 * Catalog promos shown under the header. Add more items later to rotate
 * as a carousel — PromoBanner already accepts the list.
 */
export const CATALOG_PROMO_BANNERS: CatalogPromoBanner[] = [
  {
    id: "pide-en-casa-2026",
    eyebrow: "Nuevo",
    title: "Pide en un toque. Te llega a casa.",
    imageSrc: "/images/hero.jpeg",
    imageAlt: "Entrega a domicilio de Quick! Mini Market",
    imagePosition: "center 30%",
  },
];

export const CATALOG_PROMO_STORAGE_PREFIX = "quick-orders:promo-dismissed:";
