import { AdminExistencias } from "@/components/admin/inventario/AdminExistencias";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_EXISTENCIAS_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Existencias | Administración",
  description: "Stock, costo promedio y punto de reorden por tienda",
};

export default function Page() {
  return (
    <>
      <div className="mx-auto max-w-6xl">
        <AdminPageTabs label="Existencias" tabs={ADMIN_EXISTENCIAS_TABS} />
      </div>
      <AdminExistencias />
    </>
  );
}
