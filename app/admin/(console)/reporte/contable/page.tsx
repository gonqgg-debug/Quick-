import { AdminReporteContable } from "@/components/admin/AdminReporteContable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detalle contable | Administración",
  description: "Desglose mensual de ventas, compras, proveedores, turnos, caja y delivery",
};

export default function AdminReporteContablePage() {
  return <AdminReporteContable />;
}
