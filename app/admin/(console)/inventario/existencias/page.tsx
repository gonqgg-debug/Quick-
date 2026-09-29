import { AdminExistencias } from "@/components/admin/inventario/AdminExistencias";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Existencias | Administración",
  description: "Stock, costo promedio y punto de reorden por tienda",
};

export default function Page() {
  return <AdminExistencias />;
}
