import { AdminMensajesMasivos } from "@/components/admin/AdminMensajesMasivos";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mensajes masivos | Administración",
  description: "Envío de WhatsApp a clientes que aceptan marketing",
};

export default function AdminMensajesMasivosPage() {
  return <AdminMensajesMasivos />;
}
