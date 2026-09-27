import { AdminFacturas } from "@/components/admin/AdminFacturas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facturas | Administración",
  description: "Facturas que Phillip va capturando, con la foto original",
};

export default function AdminFacturasPage() {
  return <AdminFacturas />;
}
