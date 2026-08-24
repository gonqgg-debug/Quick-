import { AdminParametros } from "@/components/admin/AdminParametros";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parámetros | Administración",
  description: "Mes activo, umbrales y metas mensuales de Quick! Mini Market",
};

export default function AdminParametrosPage() {
  return <AdminParametros />;
}
