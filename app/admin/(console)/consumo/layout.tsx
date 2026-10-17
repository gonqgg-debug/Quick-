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
    <div className="mx-auto w-full max-w-7xl has-[.analitica-productos]:-mx-4 has-[.analitica-productos]:-my-6 has-[.analitica-productos]:max-w-none has-[.analitica-productos]:bg-[#F4F6F4] has-[.analitica-productos]:px-4 has-[.analitica-productos]:py-5 md:has-[.analitica-productos]:-mx-6 md:has-[.analitica-productos]:px-6">
      <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-[#E8EBE8]" />}>
        <ConsumoEncabezado frescura={frescura} />
      </Suspense>
      <div className="mt-6 has-[.analitica-productos]:mt-0">{children}</div>
    </div>
  );
}
