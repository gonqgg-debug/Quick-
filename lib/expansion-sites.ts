export type ExpansionBrand = "quick" | "pharmaquick";
export type ExpansionStatus = "open" | "projected";
export type PinOffset = "left" | "right" | "down";

export type ExpansionSite = {
  id: string;
  name: string;
  brand: ExpansionBrand;
  status: ExpansionStatus;
  lat: number;
  lng: number;
  area: string;
  note: string;
  shortName: string;
  landingLine: string;
  opening?: string;
  pinOffset?: PinOffset;
};

export const MAP_LANDMARKS = [
  { id: "hard-rock", name: "Hard Rock", lat: 18.7334438, lng: -68.4826329 },
  { id: "iberostar", name: "Iberostar", lat: 18.7172992, lng: -68.4523194 },
] as const;

/**
 * Landmark-relative pins for the growth map.
 * Los Robles / Green One follow the hotel strip (Hard Rock / Iberostar)
 * with the store on the inland side of Blvd. Turístico del Este.
 * Jardines 3–4 sit together in Pueblo Bávaro; pinOffset keeps both logos visible.
 * Doral Park and The Beach cluster around Downtown Punta Cana
 * (Downtown Mall / Coco Bongo); small lat/lng and pinOffset keep logos readable.
 */
export const EXPANSION_SITES: ExpansionSite[] = [
  {
    id: "jardines-3",
    name: "Residencial Jardines 3",
    brand: "quick",
    status: "open",
    lat: 18.6148,
    lng: -68.4365,
    area: "Pueblo Bávaro",
    note: "Tienda piloto, en operación",
    shortName: "Jardines 3",
    landingLine: "Quick! · Pueblo Bávaro",
    pinOffset: "left",
  },
  {
    id: "jardines-4",
    name: "Jardines 4",
    brand: "quick",
    status: "projected",
    lat: 18.6162,
    lng: -68.4342,
    area: "Pueblo Bávaro",
    note: "Junto a Jardines 3",
    shortName: "Jardines 4",
    landingLine: "Quick! · Pueblo Bávaro",
    pinOffset: "right",
  },
  {
    id: "los-robles",
    name: "Los Robles",
    brand: "quick",
    status: "projected",
    // Hard Rock Hotel & Casino Punta Cana: 18.73344, -68.48263 (playa).
    // Pin: same height, inland / other side of the highway.
    lat: 18.73344,
    lng: -68.4905,
    area: "Macao / Arena Gorda",
    note: "A la altura del Hard Rock, lado interior de la carretera",
    shortName: "Los Robles",
    landingLine: "Quick! · A la altura del Hard Rock",
  },
  {
    id: "green-one",
    name: "Green One Village and Resort",
    brand: "quick",
    status: "projected",
    // Iberostar Waves Punta Cana: 18.71730, -68.45232 (playa).
    // Pin: facing the hotel, inland side of the road.
    lat: 18.7173,
    lng: -68.46,
    area: "Arena Gorda / Bávaro",
    note: "Enfrente del Iberostar Bávaro",
    shortName: "Green One",
    landingLine: "Quick! · Frente al Iberostar",
  },
  {
    id: "doral-park",
    name: "Doral Park",
    brand: "quick",
    status: "projected",
    // Downtown Mall Punta Cana: 18.63701, -68.39758. Doral Park is ~1 min away.
    lat: 18.6378,
    lng: -68.3992,
    area: "Downtown Punta Cana",
    note: "Junto a Downtown Mall",
    shortName: "Doral Park",
    landingLine: "Quick! · Downtown Punta Cana",
    pinOffset: "left",
  },
  {
    id: "doral-park-pharma",
    name: "Doral Park",
    brand: "pharmaquick",
    status: "projected",
    lat: 18.6368,
    lng: -68.3978,
    area: "Downtown Punta Cana",
    note: "PharmaQuick! en Doral Park",
    shortName: "Doral Park",
    landingLine: "PharmaQuick! · Downtown Punta Cana",
    pinOffset: "right",
  },
  {
    id: "the-beach",
    name: "The Beach",
    brand: "quick",
    status: "projected",
    // Coco Bongo Punta Cana: 18.63518, -68.39500. The Beach sits next to Downtown.
    lat: 18.6353,
    lng: -68.3958,
    area: "Downtown Punta Cana",
    note: "The Beach at Punta Cana City Place",
    shortName: "The Beach",
    landingLine: "Quick! · Downtown Punta Cana",
  },
  {
    id: "pharma-crisfer",
    name: "Plaza Crisfer, Local 11",
    brand: "pharmaquick",
    status: "projected",
    lat: 18.6065,
    lng: -68.4235,
    area: "Pueblo Bávaro / Verón",
    note: "PharmaQuick! · apertura noviembre 2026",
    shortName: "PharmaQuick!",
    landingLine: "PharmaQuick! · Verón",
    opening: "Noviembre 2026",
  },
];

export function siteLogoSrc(brand: ExpansionBrand): string {
  return brand === "pharmaquick" ? "/brand/pharma-logo.svg" : "/brand/logo.svg";
}
