import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Empleados | Quick! Mini Market",
  description: "Acceso del personal de Delivery y de Administración",
};

export default function EmpleadosPage() {
  return (
    <main className="relative min-h-screen" style={{ color: brand.ink }}>
      <div className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-5 md:px-8">
          <Link href="/" aria-label="Volver al inicio">
            <Logo className="h-10 max-w-[160px] md:h-12 md:max-w-[180px]" />
          </Link>
          <Link
            href="/"
            className="text-sm font-bold underline-offset-2 hover:underline md:text-brand-ink"
            style={{ color: brand.muted }}
          >
            Volver
          </Link>
        </div>
      </div>

      <div className="grid min-h-screen md:grid-cols-2">
        <GatePanel
          eyebrow="Personal de tienda"
          title="Delivery"
          description="Pedidos en curso, chat con clientes y el flujo del día a día."
          href="/staff"
          action="Entrar a Delivery"
          tone="orange"
        />
        <GatePanel
          eyebrow="Back office"
          title="Administración"
          description="Caja, ventas, compras, catálogo y el resto de la operación."
          href="/admin/login"
          action="Entrar a Administración"
          tone="green"
        />
      </div>
    </main>
  );
}

function GatePanel({
  eyebrow,
  title,
  description,
  href,
  action,
  tone,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  tone: "orange" | "green";
}) {
  const accent = tone === "orange" ? brand.orange : brand.green;
  const wash = tone === "orange" ? "#FFF7ED" : "#F1F7EA";

  return (
    <section
      className="flex flex-col justify-center px-6 py-28 md:px-12 lg:px-16"
      style={{ backgroundColor: wash }}
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>
        {eyebrow}
      </p>
      <h1 className="font-display mt-3 text-4xl font-extrabold md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-sm text-base leading-relaxed" style={{ color: brand.muted }}>
        {description}
      </p>
      <Link
        href={href}
        className="mt-8 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-full px-7 py-3.5 text-base font-bold text-white"
        style={{ backgroundColor: accent }}
      >
        {action}
      </Link>
    </section>
  );
}
