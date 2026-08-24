import { AdminCajaRecuento } from "@/components/admin/AdminCajaRecuento";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recuento de caja | Administración",
  description: "Calculadora de billetes contra el saldo esperado",
};

export default function AdminCajaRecuentoPage() {
  return <AdminCajaRecuento />;
}
