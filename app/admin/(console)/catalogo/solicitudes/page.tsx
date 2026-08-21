import { AdminProductRequests } from "@/components/admin/AdminProductRequests";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Solicitudes de producto | Administración",
  description: "Revisar productos que los clientes no encontraron en el catálogo",
};

export default function AdminCatalogSolicitudesPage() {
  return <AdminProductRequests />;
}
