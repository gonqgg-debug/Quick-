const KEY = "catalogo-productos-lista";

export type ListaProductos = { ids: string[]; query: string };

export function guardarListaProductos(lista: ListaProductos) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(lista));
  } catch {
    // The list still works if the browser blocks storage.
  }
}

export function leerListaProductos(): ListaProductos | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ListaProductos>;
    if (!Array.isArray(parsed.ids)) {
      return null;
    }
    return {
      ids: parsed.ids.filter((id): id is string => typeof id === "string" && Boolean(id)),
      query: typeof parsed.query === "string" ? parsed.query : "",
    };
  } catch {
    return null;
  }
}
