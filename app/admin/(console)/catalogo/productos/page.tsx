import { AdminCatalogProducts } from "@/components/admin/AdminCatalogProducts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Productos | Administración",
  description: "Revisar y editar el catálogo",
};

export default function AdminCatalogProductsPage() {
  return <AdminCatalogProducts />;
}
