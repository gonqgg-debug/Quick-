export const brand = {
  green: "#7EB341",
  orange: "#F79521",
  blue: "#1F82C5",
  white: "#FFFFFF",
  cream: "#FFF6E8",
  ink: "#1A1A1A",
  muted: "#6B7280",
  error: "#DC2626",
} as const;

export type BrandColor = keyof typeof brand;
export type BrandBadgeVariant = "green" | "orange" | "blue";

export const brandChipColors = [brand.green, brand.orange, brand.blue] as const;

export function brandChipColor(index: number): (typeof brandChipColors)[number] {
  return brandChipColors[index % brandChipColors.length];
}

export function isPharmaCategory(categoria: string): boolean {
  return /pharma|farmacia|medicament|salud/i.test(categoria);
}

const CATEGORY_EMOJI: Record<string, string> = {
  all: "🛒",
  todos: "🛒",
  almacen: "🥫",
  bebidas: "🥤",
  "bebidas no alcoholicas": "🥤",
  "bebidas alcoholicas": "🍷",
  frutas: "🍎",
  farmacia: "💊",
  "snacks y dulces": "🍪",
  "cereales y desayunos": "🥣",
  verduras: "🥬",
  "condimentos y especias": "🧂",
  lacteos: "🥛",
  "lacteos y derivados": "🧀",
  "carnes y embutidos": "🥓",
};

function normalizeCategoryKey(categoria: string): string {
  return categoria
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function categoryEmoji(categoria: string): string {
  return CATEGORY_EMOJI[normalizeCategoryKey(categoria)] ?? "🏷️";
}

export const logoPublicPath = "/brand/logo.svg";
export const logoContourPublicPath = "/brand/logo-contour.png";
export const pharmaLogoPublicPath = "/brand/pharma-logo.svg";
export const quickCoinsLogoPublicPath = "/brand/quickcoins-logo.png";

export const defaultWhatsappNumber = "18092264986";

export function whatsappHref(): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || defaultWhatsappNumber;
  return `https://wa.me/${raw.replace(/[^\d]/g, "")}`;
}
