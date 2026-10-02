import { AdminPageTabs } from "@/components/admin/shell/AdminPageTabs";
import { ADMIN_VENTAS_TABS } from "@/lib/admin-nav";

export default function AdminVentasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminPageTabs label="Ventas" tabs={ADMIN_VENTAS_TABS} />
      {children}
    </>
  );
}
