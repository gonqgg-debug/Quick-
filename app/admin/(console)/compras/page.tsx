import { AdminCompras } from "@/components/admin/AdminCompras";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compras | Administración",
  description: "Compras pendientes y historial de pagos a proveedores",
};

export default function AdminComprasPage() {
  return <AdminCompras />;
}
