import { AdminPedidosSupervision } from "@/components/admin/operacion/AdminPedidosSupervision";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Supervisión | Administración",
  description: "Cola en vivo y métricas del día de pedidos",
};

export default function AdminPedidosSupervisionPage() {
  return <AdminPedidosSupervision />;
}
