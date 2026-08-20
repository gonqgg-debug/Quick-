import { AdminHistory } from "@/components/admin/AdminHistory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Historial | Administración",
  description: "Historial de pedidos Quick! Mini Market",
};

export default function AdminHistorialPage() {
  return <AdminHistory />;
}
