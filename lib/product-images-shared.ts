export type CatalogImageSource = "open_food_facts" | "web" | "upload" | "nacional";

export type CatalogImageStats = {
  total: number;
  confirmed: number;
  withBarcode: number;
  pendingReview: number;
  awaitingOff: number;
  awaitingNacional: number;
  awaitingWeb: number;
  withoutBarcode: number;
};

export type CatalogImageQueuePage = {
  items: CatalogImageQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  letter: string | null;
};

export type CatalogImageQueueItem = {
  id: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  codigoBarras: string | null;
  fotoUrl: string | null;
  suggestion: {
    id: string;
    imageUrl: string;
    source: CatalogImageSource;
  } | null;
};
