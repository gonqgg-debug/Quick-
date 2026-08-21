import { AdminHistory } from "@/components/admin/AdminHistory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Historial de Delivery | Administración",
  description: "Historial de Delivery de Quick! Mini Market",
};

export default function AdminHistorialPage() {
  return <AdminHistory />;
}
