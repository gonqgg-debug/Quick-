import { AdminReporteContable } from "@/components/admin/contabilidad/AdminReporteContable";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_REPORTE_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detalle contable | Administración",
  description: "Desglose mensual de ventas, compras, proveedores, turnos, caja y delivery",
};

export default function AdminReporteContablePage() {
  return (
    <>
      <div className="mx-auto max-w-6xl">
        <AdminPageTabs label="Reportes" tabs={ADMIN_REPORTE_TABS} />
      </div>
      <AdminReporteContable />
    </>
  );
}
