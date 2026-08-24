import { AdminCajaBalances } from "@/components/admin/AdminCajaBalances";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caja | Administración",
  description: "Saldos esperados de caja chica y caja fuerte",
};

export default function AdminCajaBalancesPage() {
  return <AdminCajaBalances />;
}
