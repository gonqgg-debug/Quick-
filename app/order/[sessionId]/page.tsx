import { CatalogExperience } from "@/components/catalog/CatalogExperience";
import { InvalidSession } from "@/components/catalog/InvalidSession";
import { getActiveOrderSession, getActiveProducts, getOrderDraft } from "@/lib/catalog";
import { getCustomerForChat } from "@/lib/customers";
import type { OrderDraft, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type OrderCatalogPageProps = {
  params: {
    sessionId: string;
  };
};

export default async function OrderCatalogPage({ params }: OrderCatalogPageProps) {
  let session = null;
  let products: Product[] = [];
  let editOrder: OrderDraft | null = null;
  let customer = null;
  let unavailable = false;

  try {
    session = await getActiveOrderSession(params.sessionId);
    if (session) {
      products = await getActiveProducts();
      customer = await getCustomerForChat(session.chat_id);
      if (session.edit_order_id) {
        editOrder = await getOrderDraft(session.edit_order_id);
      }
    }
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    return (
      <InvalidSession
        title="No pudimos abrir el catálogo"
        message="Inténtalo de nuevo en un momento. Si sigue fallando, solicita un enlace nuevo por WhatsApp."
      />
    );
  }

  if (!session) {
    return <InvalidSession />;
  }

  if (session.edit_order_id && !editOrder) {
    return (
      <InvalidSession
        title="No pudimos cargar tu pedido"
        message="Este enlace de edición ya no es válido. Solicita uno nuevo por WhatsApp."
      />
    );
  }

  return (
    <CatalogExperience
      sessionId={session.id}
      products={products}
      editOrder={editOrder}
      customer={customer}
    />
  );
}
