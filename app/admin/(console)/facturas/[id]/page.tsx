import { FacturaPagina } from "@/components/admin/facturas/FacturaPagina";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Factura | Administración",
  description: "Ficha de la compra con el documento original",
};

export default function AdminFacturaPage({ params }: { params: { id: string } }) {
  return <FacturaPagina id={decodeURIComponent(params.id)} />;
}
