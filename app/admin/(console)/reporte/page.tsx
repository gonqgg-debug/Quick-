import { AdminReporte } from "@/components/admin/AdminReporte";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reporte mensual | Administración",
  description: "Resumen financiero mes a mes de ventas, compras, caja y delivery",
};

export default function AdminReportePage() {
  return <AdminReporte />;
}
