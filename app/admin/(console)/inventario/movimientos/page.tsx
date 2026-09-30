import { AdminMovimientos } from "@/components/admin/inventario/AdminMovimientos";
import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_EXISTENCIAS_TABS } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movimientos | Administración",
  description: "Libro de entradas y salidas de inventario",
};

export default function Page() {
  return (
    <>
      <div className="mx-auto max-w-6xl">
        <AdminPageTabs label="Existencias" tabs={ADMIN_EXISTENCIAS_TABS} />
      </div>
      <AdminMovimientos />
    </>
  );
}
