import { AdminProductRequests } from "@/components/admin/inventario/AdminProductRequests";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_PRODUCTO_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Solicitudes de producto | Administración",
  description: "Revisar productos que los clientes no encontraron en el catálogo",
};

export default function AdminCatalogSolicitudesPage() {
  return (
    <>
      <AdminPageTabs label="Productos" tabs={ADMIN_PRODUCTO_TABS} />
      <AdminProductRequests />
    </>
  );
}
