export type CatalogImageStats = {
  total: number;
  confirmed: number;
  withBarcode: number;
  pendingReview: number;
  awaitingOff: number;
  withoutBarcode: number;
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
    source: "open_food_facts" | "web" | "upload";
  } | null;
};
