import { AdminClientes } from "@/components/admin/AdminClientes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clientes | Administración",
  description: "Directorio de clientes y métricas de pedidos",
};

export default function AdminClientesPage() {
  return <AdminClientes />;
}
