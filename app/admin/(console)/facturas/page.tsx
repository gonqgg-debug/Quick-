import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FacturasLista } from "@/components/admin/facturas/FacturasLista";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facturas | Administración",
  description: "Facturas que Phillip va capturando, con la foto original",
};

export default function AdminFacturasPage({ searchParams }: { searchParams: { factura?: string | string[] } }) {
  const factura = Array.isArray(searchParams.factura) ? searchParams.factura[0] : searchParams.factura;
  if (factura?.trim()) {
    redirect(`/admin/facturas/${encodeURIComponent(factura.trim())}`);
  }
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />}>
      <FacturasLista />
    </Suspense>
  );
}
