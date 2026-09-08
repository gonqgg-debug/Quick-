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
  almacen: "🛒",
  "articulos de conveniencia": "🛒",
  conveniencia: "🛒",
  abarrotes: "🛒",
  "aceites y grasas": "🫒",
  aceites: "🫒",
  bebidas: "🥤",
  "bebidas no alcoholicas": "🥤",
  "bebidas alcoholicas": "🍷",
  aguas: "💧",
  jugos: "🧃",
  frutas: "🍎",
  verduras: "🥬",
  farmacia: "💊",
  "snacks y dulces": "🍪",
  snacks: "🍪",
  dulces: "🍬",
  "cereales y desayunos": "🥣",
  cereales: "🥣",
  desayunos: "🥣",
  "condimentos y especias": "🧂",
  condimentos: "🧂",
  lacteos: "🥛",
  "lacteos y derivados": "🧀",
  "carnes y embutidos": "🥓",
  limpieza: "🧹",
  "cuidado personal": "🧴",
  higiene: "🧴",
  panaderia: "🍞",
  enlatados: "🥫",
  conservas: "🥫",
  congelados: "🧊",
  granos: "🌾",
  pastas: "🍝",
  huevos: "🥚",
  cafe: "☕",
  "cafe y te": "☕",
  cigarrillos: "🚬",
  tabaco: "🚬",
  bebes: "🍼",
  "bebe e infantil": "🍼",
  mascotas: "🐾",
  papel: "🧻",
  desechables: "🧻",
};

const CATEGORY_EMOJI_RULES: Array<{ test: RegExp; emoji: string }> = [
  { test: /aceite|grasa/, emoji: "🫒" },
  { test: /alcohol|cerveza|vino|ron|whisky|licor/, emoji: "🍷" },
  { test: /agua/, emoji: "💧" },
  { test: /jugo|nectar/, emoji: "🧃" },
  { test: /bebida|refresco|soda/, emoji: "🥤" },
  { test: /fruta/, emoji: "🍎" },
  { test: /verdura|vegetal|hortaliza/, emoji: "🥬" },
  { test: /lacteo|leche|queso|yogurt|yogur/, emoji: "🥛" },
  { test: /cereal|desayuno|avena|granola/, emoji: "🥣" },
  { test: /snack|pasaboca|chips|cheeto/, emoji: "🍪" },
  { test: /dulce|galleta|chocolate|caramelo|gomita/, emoji: "🍬" },
  { test: /condimento|especia|salsa|aderezo/, emoji: "🧂" },
  { test: /carne|embutido|jamon|salchicha|pollo/, emoji: "🥓" },
  { test: /pharma|farmacia|medicament|salud/, emoji: "💊" },
  { test: /limpieza|detergente|cloro|lavaplatos/, emoji: "🧹" },
  { test: /higiene|shampoo|cuidado personal|dental|desodorante/, emoji: "🧴" },
  { test: /panader|panes/, emoji: "🍞" },
  { test: /cafe|te\b|infusion/, emoji: "☕" },
  { test: /enlatad|conserva/, emoji: "🥫" },
  { test: /congelad|hielo/, emoji: "🧊" },
  { test: /cigarr|tabaco/, emoji: "🚬" },
  { test: /bebe|panal|pañal/, emoji: "🍼" },
  { test: /mascota|perro|gato/, emoji: "🐾" },
  { test: /papel|servilleta|toalla|desechable/, emoji: "🧻" },
  { test: /arroz|grano|pasta|fideo/, emoji: "🍝" },
  { test: /huevo/, emoji: "🥚" },
  { test: /convenien|almacen|abarrotes/, emoji: "🛒" },
];

export function normalizeCategoryKey(categoria: string): string {
  return categoria
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function categoryEmoji(categoria: string): string {
  const key = normalizeCategoryKey(categoria);
  if (!key) {
    return "🛒";
  }
  if (CATEGORY_EMOJI[key]) {
    return CATEGORY_EMOJI[key];
  }
  const rule = CATEGORY_EMOJI_RULES.find((item) => item.test.test(key));
  return rule?.emoji ?? "🛒";
}

export const logoPublicPath = "/brand/logo.svg";
export const logoContourPublicPath = "/brand/logo-contour.png";
export const pharmaLogoPublicPath = "/brand/pharma-logo.png";
export const quickCoinsLogoPublicPath = "/brand/quickcoins-logo.png";

export const defaultWhatsappNumber = "18092264986";

export function whatsappHref(): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || defaultWhatsappNumber;
  return `https://wa.me/${raw.replace(/[^\d]/g, "")}`;
}
