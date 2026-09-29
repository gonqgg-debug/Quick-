import { AdminConteos } from "@/components/admin/inventario/AdminConteos";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conteos | Administración",
  description: "Conteo físico de inventario",
};

export default function Page() {
  return <AdminConteos />;
}
