const KEY = "quick-admin-facturas-lista";

export type ListaGuardada = {
  ids: string[];
  /** Query string of the list view, without the leading "?". */
  query: string;
};

export function guardarLista(lista: ListaGuardada): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(lista));
  } catch {
    /* private mode or quota */
  }
}

export function leerLista(): ListaGuardada | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ListaGuardada>;
    if (!Array.isArray(parsed.ids)) {
      return null;
    }
    return { ids: parsed.ids.filter((id): id is string => typeof id === "string"), query: typeof parsed.query === "string" ? parsed.query : "" };
  } catch {
    return null;
  }
}

export function urlDeLista(query: string): string {
  return query ? `/admin/facturas?${query}` : "/admin/facturas";
}
