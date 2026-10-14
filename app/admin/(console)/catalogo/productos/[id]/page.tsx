import { Suspense } from "react";
import { AdminCatalogProductFicha } from "@/components/admin/AdminCatalogProductFicha";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Producto | Administración",
  description: "Ficha del producto con precio, costo y proveedores",
};

export default function AdminCatalogProductPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />}>
      <AdminCatalogProductFicha id={decodeURIComponent(params.id)} />
    </Suspense>
  );
}
