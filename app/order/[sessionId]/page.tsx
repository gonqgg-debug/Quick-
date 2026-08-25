import { CatalogExperience } from "@/components/catalog/CatalogExperience";
import { InvalidSession } from "@/components/catalog/InvalidSession";
import {
  getActiveOrderSession,
  getActiveProductsByIds,
  getOrderDraft,
  listActiveCatalogCategories,
} from "@/lib/catalog";
import {
  getCatalogRecommendations,
  type CatalogRecommendations,
} from "@/lib/catalog-recommendations";
import { getCustomerForChat } from "@/lib/customers";
import type { CatalogCategoryChip } from "@/lib/catalog-products-shared";
import type { OrderDraft, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type OrderCatalogPageProps = {
  params: {
    sessionId: string;
  };
};

export default async function OrderCatalogPage({ params }: OrderCatalogPageProps) {
  let session = null;
  let categories: CatalogCategoryChip[] = [];
  let seedProducts: Product[] = [];
  let editOrder: OrderDraft | null = null;
  let customer = null;
  let recommendations: CatalogRecommendations = {
    bestSellers: [],
    lastOrder: null,
    favorites: [],
  };
  let unavailable = false;

  try {
    session = await getActiveOrderSession(params.sessionId);
    if (session) {
      customer = await getCustomerForChat(session.chat_id);
      const [catalogCategories, catalogRecommendations] = await Promise.all([
        listActiveCatalogCategories(),
        getCatalogRecommendations(customer?.id ?? null),
      ]);
      categories = catalogCategories;
      recommendations = catalogRecommendations;
      if (session.edit_order_id) {
        editOrder = await getOrderDraft(session.edit_order_id);
        if (editOrder) {
          seedProducts = await getActiveProductsByIds(editOrder.items.map((item) => item.productId));
        }
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
      categories={categories}
      seedProducts={seedProducts}
      editOrder={editOrder}
      customer={customer}
      recommendations={recommendations}
    />
  );
}
