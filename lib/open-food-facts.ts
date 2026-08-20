const OFF_USER_AGENT = "QuickMiniMarket/1.0 (quickminimarkets@gmail.com)";

export type OffProductImage = {
  barcode: string;
  imageUrl: string;
  productName: string | null;
};

type OffSelected = {
  front?: { display?: Record<string, string>; small?: Record<string, string> };
};

type OffResponse = {
  status?: number;
  product?: {
    product_name?: unknown;
    image_front_url?: unknown;
    image_url?: unknown;
    selected_images?: OffSelected;
  };
};

export async function fetchOpenFoodFactsImage(barcode: string): Promise<OffProductImage | null> {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,image_front_url,image_url,selected_images`,
    {
      headers: {
        "User-Agent": OFF_USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Open Food Facts respondió ${response.status}`);
  }
  const body = (await response.json()) as OffResponse;
  if (body.status !== 1 || !body.product) {
    return null;
  }
  const imageUrl = pickOffImage(body.product);
  if (!imageUrl) {
    return null;
  }
  return {
    barcode,
    imageUrl,
    productName: typeof body.product.product_name === "string" ? body.product.product_name : null,
  };
}

function pickOffImage(product: NonNullable<OffResponse["product"]>): string | null {
  const display = product.selected_images?.front?.display;
  if (display) {
    const preferred = display.es || display.en || display.fr || Object.values(display)[0];
    if (typeof preferred === "string" && preferred.startsWith("http")) {
      return preferred;
    }
  }
  if (typeof product.image_front_url === "string" && product.image_front_url.startsWith("http")) {
    return product.image_front_url;
  }
  if (typeof product.image_url === "string" && product.image_url.startsWith("http")) {
    return product.image_url;
  }
  return null;
}
