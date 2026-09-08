const NACIONAL_GRAPHQL = "https://supermercadosnacional.com/graphql";
const NACIONAL_USER_AGENT = "QuickMiniMarket/1.0 (quickminimarkets@gmail.com)";
const NAME_SEARCH_PAGE_SIZE = 20;
const MIN_NAME_SCORE = 0.5;
const STRONG_NAME_SCORE = 0.72;

const STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "con",
  "para",
  "en",
  "un",
  "una",
  "und",
  "paq",
  "gr",
  "ml",
  "lt",
  "lts",
  "onz",
  "oz",
  "kg",
  "g",
  "u",
  "und",
]);

const PRODUCT_SELECTION = `
  name
  sku
  eans
  image { url }
  media_gallery { url }
`;

export type NacionalImageHit = {
  url: string;
  title: string;
  sku: string | null;
  score: number;
  match: "barcode" | "name";
};

type NacionalProduct = {
  name?: unknown;
  sku?: unknown;
  eans?: unknown;
  image?: { url?: unknown } | null;
  media_gallery?: Array<{ url?: unknown } | null> | null;
};

type NacionalProductsPayload = {
  data?: {
    products?: {
      items?: NacionalProduct[];
    };
  };
  errors?: Array<{ message?: string }>;
};

export function tokenizeProductText(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function barcodeVariants(barcode: string): string[] {
  const digits = barcode.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) {
    return [];
  }
  const variants = new Set<string>([digits]);
  const stripped = digits.replace(/^0+/, "") || digits;
  variants.add(stripped);
  if (digits.length === 13 && digits.startsWith("0")) {
    variants.add(digits.slice(1));
  }
  if (digits.length === 12) {
    variants.add(`0${digits}`);
  }
  if (digits.length === 11) {
    variants.add(`0${digits}`);
    variants.add(`00${digits}`);
  }
  return Array.from(variants);
}

export function eansIncludeBarcode(eans: string, barcode: string): boolean {
  const wanted = new Set(barcodeVariants(barcode));
  if (wanted.size === 0) {
    return false;
  }
  return eans.split(/[;,|\s]+/).some((part) => {
    const digits = part.replace(/\D/g, "");
    return wanted.has(digits) || barcodeVariants(digits).some((variant) => wanted.has(variant));
  });
}

export function scoreNacionalNameMatch(nombre: string, marca: string | null, nacionalName: string): number {
  const queryTokens = tokenizeProductText([marca, nombre].filter(Boolean).join(" "));
  const nameTokens = new Set(tokenizeProductText(nacionalName));
  if (queryTokens.length === 0 || nameTokens.size === 0) {
    return 0;
  }
  const hits = queryTokens.filter((token) => nameTokens.has(token)).length;
  let score = hits / queryTokens.length;
  const brandTokens = tokenizeProductText(marca ?? "").filter((token) => token.length >= 3);
  if (brandTokens.length > 0) {
    const brandHits = brandTokens.filter((token) => nameTokens.has(token)).length;
    score = brandHits === 0 ? score * 0.35 : Math.min(1, score + 0.15);
  }
  return score;
}

export function isConfidentNacionalMatch(score: number, marca: string | null, nacionalName: string): boolean {
  if (score >= STRONG_NAME_SCORE) {
    return true;
  }
  if (score < MIN_NAME_SCORE) {
    return false;
  }
  const brandTokens = tokenizeProductText(marca ?? "").filter((token) => token.length >= 4);
  if (brandTokens.length === 0) {
    return score >= 0.6;
  }
  const nameTokens = new Set(tokenizeProductText(nacionalName));
  return brandTokens.every((token) => nameTokens.has(token));
}

export function isNacionalCatalogImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith("supermercadosnacional.com") &&
      parsed.pathname.includes("/media/catalog/") &&
      !isPlaceholderUrl(url)
    );
  } catch {
    return false;
  }
}

export function cleanNacionalImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export async function searchNacionalProductImage(options: {
  nombre: string;
  marca?: string | null;
  barcode?: string | null;
}): Promise<{ hit: NacionalImageHit | null; reason: string }> {
  const barcode = (options.barcode ?? "").replace(/\D/g, "");
  if (barcode.length >= 8) {
    const byBarcode = await searchNacionalByBarcode(barcode);
    if (byBarcode) {
      return { hit: byBarcode, reason: `EAN ${barcode} en Nacional` };
    }
  }

  const ranked = await searchNacionalByName(options.nombre, options.marca ?? null);
  const best = ranked[0];
  if (best && isConfidentNacionalMatch(best.score, options.marca ?? null, best.title)) {
    return { hit: best, reason: `Nacional: ${best.title}` };
  }
  if (best) {
    return { hit: null, reason: `Nacional cercano pero no seguro: ${best.title}` };
  }
  return { hit: null, reason: "Nacional no tiene un match claro" };
}

export async function searchNacionalImageCandidates(options: {
  query: string;
  barcode?: string | null;
  take?: number;
}): Promise<Array<{ url: string; title: string }>> {
  const take = Math.min(Math.max(options.take ?? 5, 1), 8);
  const seen = new Set<string>();
  const results: Array<{ url: string; title: string }> = [];

  const barcode = (options.barcode ?? "").replace(/\D/g, "");
  if (barcode.length >= 8) {
    const byBarcode = await searchNacionalByBarcode(barcode);
    if (byBarcode && !seen.has(byBarcode.url)) {
      seen.add(byBarcode.url);
      results.push({ url: byBarcode.url, title: byBarcode.title });
    }
  }

  const query = options.query.trim();
  if (query.length >= 2 && results.length < take) {
    const ranked = await searchNacionalByName(query, null);
    for (const hit of ranked) {
      if (seen.has(hit.url) || hit.score < 0.4) {
        continue;
      }
      seen.add(hit.url);
      results.push({ url: hit.url, title: hit.title });
      if (results.length >= take) {
        break;
      }
    }
  }

  return results.slice(0, take);
}

async function searchNacionalByBarcode(barcode: string): Promise<NacionalImageHit | null> {
  for (const variant of barcodeVariants(barcode)) {
    const items = await nacionalProducts(
      `query NacionalByEan($ean: String!) {
        products(filter: { eans: { match: $ean } }, pageSize: 5) {
          items { ${PRODUCT_SELECTION} }
        }
      }`,
      { ean: variant }
    );
    for (const item of items) {
      const eans = typeof item.eans === "string" ? item.eans : "";
      if (eans && !eansIncludeBarcode(eans, barcode)) {
        continue;
      }
      const hit = toImageHit(item, 1, "barcode");
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

async function searchNacionalByName(nombre: string, marca: string | null): Promise<NacionalImageHit[]> {
  const queries = nacionalSearchQueries(nombre, marca);
  const ranked: NacionalImageHit[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const items = await nacionalProducts(
      `query NacionalSearch($q: String!, $pageSize: Int!) {
        products(search: $q, pageSize: $pageSize) {
          items { ${PRODUCT_SELECTION} }
        }
      }`,
      { q: query, pageSize: NAME_SEARCH_PAGE_SIZE }
    );
    for (const item of items) {
      const name = typeof item.name === "string" ? item.name : "";
      const score = scoreNacionalNameMatch(nombre, marca, name);
      const hit = toImageHit(item, score, "name");
      if (!hit || seen.has(hit.url)) {
        continue;
      }
      seen.add(hit.url);
      ranked.push(hit);
    }
  }

  return ranked.sort((left, right) => right.score - left.score);
}

function nacionalSearchQueries(nombre: string, marca: string | null): string[] {
  const name = nombre.trim();
  const brand = (marca ?? "").trim();
  const full = [brand, name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const queries = [full, name].filter((query) => query.length >= 2);
  return Array.from(new Set(queries)).slice(0, 2);
}

async function nacionalProducts(query: string, variables: Record<string, unknown>): Promise<NacionalProduct[]> {
  const response = await fetch(NACIONAL_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": NACIONAL_USER_AGENT,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Nacional respondió ${response.status}`);
  }
  const body = (await response.json()) as NacionalProductsPayload;
  if (body.errors?.length) {
    const message = body.errors.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(message || "Nacional GraphQL error");
  }
  return body.data?.products?.items ?? [];
}

function toImageHit(
  item: NacionalProduct,
  score: number,
  match: NacionalImageHit["match"]
): NacionalImageHit | null {
  const url = pickNacionalImageUrl(item);
  if (!url) {
    return null;
  }
  return {
    url,
    title: typeof item.name === "string" ? item.name : "",
    sku: typeof item.sku === "string" ? item.sku : null,
    score,
    match,
  };
}

function pickNacionalImageUrl(item: NacionalProduct): string | null {
  const candidates = [
    typeof item.image?.url === "string" ? item.image.url : "",
    ...(Array.isArray(item.media_gallery)
      ? item.media_gallery.map((entry) => (typeof entry?.url === "string" ? entry.url : ""))
      : []),
  ];
  for (const raw of candidates) {
    if (!raw.startsWith("http") || isPlaceholderUrl(raw)) {
      continue;
    }
    const cleaned = cleanNacionalImageUrl(raw);
    if (isNacionalCatalogImage(cleaned) || cleaned.startsWith("https://")) {
      return cleaned;
    }
  }
  return null;
}

function isPlaceholderUrl(url: string): boolean {
  return /placeholder|\/no[_-]?image/i.test(url);
}
