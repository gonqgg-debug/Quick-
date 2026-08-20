import { AdminCatalogImages } from "@/components/admin/AdminCatalogImages";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Imágenes del catálogo | Administración",
  description: "Revisar y confirmar fotos de productos",
};

export default function AdminCatalogImagesPage() {
  return <AdminCatalogImages />;
}
