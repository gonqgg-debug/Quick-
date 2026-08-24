import { AdminCajaNav } from "@/components/admin/AdminCajaNav";

export default function AdminCajaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Finanzas</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Caja</h1>
      <AdminCajaNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
