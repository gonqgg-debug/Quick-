import { CatalogExperience } from "@/components/catalog/CatalogExperience";
import { InvalidSession } from "@/components/catalog/InvalidSession";
import { getActiveOrderSession, getActiveProducts } from "@/lib/catalog";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type OrderCatalogPageProps = {
  params: {
    sessionId: string;
  };
};

export default async function OrderCatalogPage({ params }: OrderCatalogPageProps) {
  let session = null;
  let products: Product[] = [];
  let unavailable = false;

  try {
    session = await getActiveOrderSession(params.sessionId);
    if (session) {
      products = await getActiveProducts();
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

  return <CatalogExperience sessionId={session.id} products={products} />;
}
