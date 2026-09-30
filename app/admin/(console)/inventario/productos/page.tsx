import { AdminCatalogProducts } from "@/components/admin/inventario/AdminCatalogProducts";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_PRODUCTO_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Productos | Administración",
  description: "Revisar y editar el catálogo",
};

export default function AdminCatalogProductsPage() {
  return (
    <>
      <AdminPageTabs label="Productos" tabs={ADMIN_PRODUCTO_TABS} />
      <AdminCatalogProducts />
    </>
  );
}
