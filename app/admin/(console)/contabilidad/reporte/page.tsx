import { AdminReporte } from "@/components/admin/contabilidad/AdminReporte";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_REPORTE_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reporte mensual | Administración",
  description: "Resumen financiero mes a mes de ventas, compras, caja y delivery",
};

export default function AdminReportePage() {
  return (
    <>
      <div className="mx-auto max-w-6xl">
        <AdminPageTabs label="Reportes" tabs={ADMIN_REPORTE_TABS} />
      </div>
      <AdminReporte />
    </>
  );
}
