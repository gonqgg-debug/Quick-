export type SerperImage = {
  url: string;
  width: number;
  height: number;
  title: string;
};

type SerperImageRow = {
  imageUrl?: unknown;
  imageWidth?: unknown;
  imageHeight?: unknown;
  title?: unknown;
};

export function buildProductImageQuery(nombre: string, marca: string | null, categoria: string | null): string {
  const brand = (marca ?? "").trim();
  const name = nombre.trim();
  const core = brand && name.toLowerCase().includes(brand.toLowerCase()) ? name : [brand, name].filter(Boolean).join(" ");
  const grocery = categoria && /farmacia|pharma/i.test(categoria) ? "caja" : "producto";
  return `${core} ${grocery}`.trim();
}

export async function searchSerperProductImages(query: string, take = 5): Promise<SerperImage[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Falta SERPER_API_KEY");
  }

  const response = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: 10,
      gl: "do",
      hl: "es",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Serper respondió ${response.status}`);
  }
  const body = (await response.json()) as { images?: SerperImageRow[] };
  const ranked = (body.images ?? [])
    .map((row) => {
      const url = typeof row.imageUrl === "string" ? row.imageUrl : "";
      const width = Number(row.imageWidth) || 0;
      const height = Number(row.imageHeight) || 0;
      return {
        url,
        width,
        height,
        title: typeof row.title === "string" ? row.title : "",
        pixels: width * height,
      };
    })
    .filter((row) => row.url.startsWith("http") && row.pixels > 0)
    .sort((left, right) => right.pixels - left.pixels);

  const unique: SerperImage[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (seen.has(row.url)) {
      continue;
    }
    seen.add(row.url);
    unique.push({ url: row.url, width: row.width, height: row.height, title: row.title });
    if (unique.length >= take) {
      break;
    }
  }
  return unique;
}
