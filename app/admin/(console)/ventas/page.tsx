import { AdminVentas } from "@/components/admin/AdminVentas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ventas | Administración",
  description: "Captura diaria de ventas reales",
};

export default function AdminVentasPage() {
  return <AdminVentas />;
}
