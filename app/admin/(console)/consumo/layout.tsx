import { Suspense } from "react";
import { ConsumoEncabezado } from "@/components/admin/consumo/ConsumoEncabezado";
import { cargarFrescura } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export default async function ConsumoLayout({ children }: { children: React.ReactNode }) {
  let frescura = null;
  try {
    frescura = await cargarFrescura();
  } catch {
    frescura = null;
  }
  return (
    <div className="mx-auto max-w-7xl">
      <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-[#F3F4F6]" />}>
        <ConsumoEncabezado frescura={frescura} />
      </Suspense>
      <div className="mt-6">{children}</div>
    </div>
  );
}
