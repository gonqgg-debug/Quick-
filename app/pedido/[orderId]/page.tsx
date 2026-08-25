import type { Metadata } from "next";
import { InvalidSession } from "@/components/catalog/InvalidSession";
import { PublicOrderView } from "@/components/catalog/PublicOrderView";
import { getPublicOrder } from "@/lib/customer-orders";
import { formatOrderNumber } from "@/lib/order-display";

export const dynamic = "force-dynamic";

type PublicPedidoPageProps = {
  params: {
    orderId: string;
  };
};

export async function generateMetadata({ params }: PublicPedidoPageProps): Promise<Metadata> {
  const order = await getPublicOrder(params.orderId).catch(() => null);
  return {
    title: order
      ? `Pedido #${formatOrderNumber(order.id)} | Quick! Mini Market`
      : "Pedido | Quick! Mini Market",
    robots: { index: false, follow: false },
  };
}

export default async function PublicPedidoPage({ params }: PublicPedidoPageProps) {
  let order = null;
  let unavailable = false;

  try {
    order = await getPublicOrder(params.orderId);
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    return (
      <InvalidSession
        title="No pudimos abrir este pedido"
        message="Inténtalo de nuevo en un momento. Si sigue fallando, escríbenos por WhatsApp."
      />
    );
  }

  if (!order) {
    return (
      <InvalidSession
        title="No encontramos este pedido"
        message="Revisa el enlace o pídenos uno nuevo por WhatsApp."
      />
    );
  }

  return <PublicOrderView order={order} />;
}
