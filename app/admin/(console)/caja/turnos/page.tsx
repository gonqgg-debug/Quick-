import { AdminCajaTurnos } from "@/components/admin/AdminCajaTurnos";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Turnos de caja | Administración",
  description: "Cierres de turno y diferencias contra el sistema",
};

export default function AdminCajaTurnosPage() {
  return <AdminCajaTurnos />;
}
