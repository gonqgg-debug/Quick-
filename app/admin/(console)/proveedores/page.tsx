import { AdminProveedores } from "@/components/admin/AdminProveedores";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proveedores | Administración",
  description: "Proveedores y condiciones de crédito",
};

export default function AdminProveedoresPage() {
  return <AdminProveedores />;
}
