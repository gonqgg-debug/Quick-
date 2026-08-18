import { brand } from "@/lib/theme";

type CartIconProps = {
  className?: string;
  color?: string;
};

export function CartIcon({ className = "h-5 w-5", color = brand.orange }: CartIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={color}
      aria-hidden="true"
    >
      <path d="M7.2 4.2h.9l.4 1.6h11.2c.6 0 1 .5.9 1.1l-1.1 6.2a1.8 1.8 0 0 1-1.8 1.5H9.3a1.8 1.8 0 0 1-1.8-1.5L6.1 4.8H4.2a.9.9 0 1 1 0-1.8h2.1c.4 0 .8.3.9.7l.2.7zm1.6 10.7a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4zm8.6 0a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z" />
    </svg>
  );
}
