export const CATALOG_PRODUCTS_PAGE_SIZE = 50;

export type AdminCatalogProduct = {
  id: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  precio: number;
  codigoOdoo: string | null;
  codigoBarras: string | null;
  fotoUrl: string | null;
  activo: boolean;
};

export type AdminCatalogProductFilters = {
  q: string;
  categoria: string;
  estado: "todos" | "activo" | "inactivo";
  page: number;
};

export type AdminCatalogProductList = {
  products: AdminCatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
};

export function catalogProductsQueryString(filters: AdminCatalogProductFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.categoria.trim()) {
    params.set("categoria", filters.categoria.trim());
  }
  if (filters.estado !== "todos") {
    params.set("estado", filters.estado);
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  return params.toString();
}

export function isUncategorized(categoria: string | null | undefined): boolean {
  return !categoria?.trim() || /^(all|todos)$/i.test(categoria.trim());
}

export function shortOdooCode(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 14) {
    return trimmed;
  }
  return `…${trimmed.slice(-8)}`;
}
