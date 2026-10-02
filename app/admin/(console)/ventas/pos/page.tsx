import { AdminPosAdvertencias } from "@/components/admin/AdminPosAdvertencias";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caja POS | Administración",
  description: "Ventas de mostrador sincronizadas con advertencia de stock",
};

export default function AdminPosAdvertenciasPage() {
  return <AdminPosAdvertencias />;
}
