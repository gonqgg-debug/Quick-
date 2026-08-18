import { brand, type BrandBadgeVariant } from "@/lib/theme";

const variantColor: Record<BrandBadgeVariant, string> = {
  green: brand.green,
  orange: brand.orange,
  blue: brand.blue,
};

type BadgeProps = {
  variant: BrandBadgeVariant;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ variant, children, className = "" }: BadgeProps) {
  const color = variantColor[variant];
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 text-xs font-bold ${className}`}
      style={{ borderColor: color, color }}
    >
      {children}
    </span>
  );
}
