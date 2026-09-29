import { AdminMovimientos } from "@/components/admin/inventario/AdminMovimientos";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movimientos | Administración",
  description: "Libro de entradas y salidas de inventario",
};

export default function Page() {
  return <AdminMovimientos />;
}
