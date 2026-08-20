import { AdminCatalogImport } from "@/components/admin/AdminCatalogImport";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Importar catálogo | Administración",
  description: "Importar productos desde Excel o CSV",
};

export default function AdminCatalogImportPage() {
  return <AdminCatalogImport />;
}
