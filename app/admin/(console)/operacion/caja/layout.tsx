import { AdminCajaNav } from "@/components/admin/operacion/AdminCajaNav";
import { AdminCajaPages } from "@/components/admin/operacion/AdminCajaPages";
import { AdminPosLink } from "@/components/admin/shell/AdminPageTabs";

export default function AdminCajaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Operación</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Caja</h1>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <AdminCajaNav />
        <AdminPosLink />
      </div>
      <div className="mt-6">
        <AdminCajaPages>{children}</AdminCajaPages>
      </div>
    </div>
  );
}
