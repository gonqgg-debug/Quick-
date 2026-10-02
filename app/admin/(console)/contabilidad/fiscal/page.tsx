import { AdminFiscal } from "@/components/admin/contabilidad/AdminFiscal";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_AJUSTES_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Datos fiscales | Administración",
  description: "Razón social, RNC y secuencia de NCF del recibo de Quick! Mini Market",
};

export default function AdminFiscalPage() {
  return (
    <>
      <div className="mx-auto max-w-3xl">
        <AdminPageTabs label="Ajustes" tabs={ADMIN_AJUSTES_TABS} />
      </div>
      <AdminFiscal />
    </>
  );
}
