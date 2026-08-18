import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/theme";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-md text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="font-display mt-6 text-3xl font-bold" style={{ color: brand.ink }}>
          Pedidos por WhatsApp
        </h1>
        <p className="mt-3" style={{ color: brand.muted }}>
          Elige del catálogo y te lo llevamos a casa.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/staff"
            className="rounded-full px-4 py-2.5 text-sm font-bold text-white"
            style={{ backgroundColor: brand.green }}
          >
            Panel de personal
          </Link>
          <Link
            href="/order/22222222-2222-4222-8222-222222222222"
            className="rounded-full border-2 px-4 py-2.5 text-sm font-bold"
            style={{ borderColor: brand.blue, color: brand.blue }}
          >
            Catálogo de ejemplo
          </Link>
        </div>
      </div>
    </main>
  );
}
