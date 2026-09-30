import { AdminCatalogImport } from "@/components/admin/inventario/AdminCatalogImport";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_PRODUCTO_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Importar catálogo | Administración",
  description: "Importar productos desde Excel o CSV",
};

export default function AdminCatalogImportPage() {
  return (
    <>
      <AdminPageTabs label="Productos" tabs={ADMIN_PRODUCTO_TABS} />
      <AdminCatalogImport />
    </>
  );
}
