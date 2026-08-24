import { AdminDiagnostico } from "@/components/admin/AdminDiagnostico";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Diagnóstico | Administración",
  description: "Verificación de los cálculos de forecast contra el Excel",
};

export default function AdminDiagnosticoPage() {
  return <AdminDiagnostico />;
}
