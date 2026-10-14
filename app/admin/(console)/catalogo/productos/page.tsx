import { Suspense } from "react";
import { AdminCatalogProducts } from "@/components/admin/AdminCatalogProducts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Productos | Administración",
  description: "Revisar y editar el catálogo",
};

export default function AdminCatalogProductsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />}>
      <AdminCatalogProducts />
    </Suspense>
  );
}
