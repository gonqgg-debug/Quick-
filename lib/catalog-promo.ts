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
    id: "celular-2026",
    eyebrow: "Nuevo",
    title: "Tu mini market, ahora en el celular.",
    imageSrc: "/images/Banner1.jpeg",
    imageAlt: "Entrega a domicilio de Quick! Mini Market",
    imagePosition: "center",
  },
];

export const CATALOG_PROMO_STORAGE_PREFIX = "quick-orders:promo-dismissed:";
