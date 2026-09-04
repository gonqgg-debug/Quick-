import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/theme";

export function PharmaFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="pb-12 pt-10" style={{ backgroundColor: brand.ink }}>
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-5 px-6 text-center md:px-8">
        <Logo variant="pharma" onDark className="h-10 max-w-[200px]" />
        <Link
          href="/"
          className="text-sm font-bold text-white/80 underline-offset-4 hover:text-white hover:underline"
        >
          Volver a Quick! Mini Market
        </Link>
        <p className="text-sm text-white/40">© {year} PharmaQuick!</p>
      </div>
    </footer>
  );
}
