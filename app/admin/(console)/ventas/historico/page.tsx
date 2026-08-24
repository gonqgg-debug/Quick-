import { AdminVentasHistorico } from "@/components/admin/AdminVentasHistorico";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Histórico de ventas | Administración",
  description: "Resumen mensual y detalle diario de ventas frente a la meta",
};

export default function AdminVentasHistoricoPage() {
  return <AdminVentasHistorico />;
}
