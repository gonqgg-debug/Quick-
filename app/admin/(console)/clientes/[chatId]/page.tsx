import { AdminClienteDetalle } from "@/components/admin/AdminClienteDetalle";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cliente | Administración",
  description: "Ficha del cliente e historial de pedidos",
};

export default function AdminClienteDetallePage() {
  return <AdminClienteDetalle />;
}
