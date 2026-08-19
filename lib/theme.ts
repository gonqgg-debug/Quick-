export const brand = {
  green: "#7EB341",
  orange: "#F79521",
  blue: "#1F82C5",
  white: "#FFFFFF",
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

export const logoPublicPath = "/brand/logo.svg";
export const pharmaLogoPublicPath = "/brand/pharma-logo.svg";

export const defaultWhatsappNumber = "18092264986";

export function whatsappHref(): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || defaultWhatsappNumber;
  return `https://wa.me/${raw.replace(/[^\d]/g, "")}`;
}
