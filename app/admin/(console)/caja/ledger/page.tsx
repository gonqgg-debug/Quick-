import { AdminCajaLedger } from "@/components/admin/AdminCajaLedger";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ledger de caja | Administración",
  description: "Entradas y salidas de caja chica y caja fuerte",
};

export default function AdminCajaLedgerPage() {
  return <AdminCajaLedger />;
}
