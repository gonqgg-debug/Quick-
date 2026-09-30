import { AdminParametros } from "@/components/admin/contabilidad/AdminParametros";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_AJUSTES_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parámetros | Administración",
  description: "Mes activo, umbrales y metas mensuales de Quick! Mini Market",
};

export default function AdminParametrosPage() {
  return (
    <>
      <div className="mx-auto max-w-5xl">
        <AdminPageTabs label="Ajustes" tabs={ADMIN_AJUSTES_TABS} />
      </div>
      <AdminParametros />
    </>
  );
}
