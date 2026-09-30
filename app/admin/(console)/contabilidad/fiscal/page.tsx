import { AdminFiscal } from "@/components/admin/contabilidad/AdminFiscal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Datos fiscales | Administración",
  description: "Razón social, RNC y secuencia de NCF del recibo de Quick! Mini Market",
};

export default function AdminFiscalPage() {
  return <AdminFiscal />;
}
