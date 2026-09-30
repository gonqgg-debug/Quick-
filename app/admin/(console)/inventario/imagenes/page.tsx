import { AdminCatalogImages } from "@/components/admin/inventario/AdminCatalogImages";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_PRODUCTO_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Imágenes del catálogo | Administración",
  description: "Revisar y confirmar fotos de productos",
};

export default function AdminCatalogImagesPage() {
  return (
    <>
      <AdminPageTabs label="Productos" tabs={ADMIN_PRODUCTO_TABS} />
      <AdminCatalogImages />
    </>
  );
}
