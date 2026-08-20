export type AdminNavItem = {
  href: string;
  label: string;
  /** `live` is routed today. `slot` is reserved in the menu for the next build. */
  status: "live" | "slot";
};

/** Active and reserved admin sections. Add new live/slot items here. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/historial", label: "Historial", status: "live" },
  { href: "/admin/catalogo", label: "Catálogo", status: "slot" },
];

/** Future sections — visible in the menu, not routed yet. */
export const ADMIN_SOON_NAV = ["Caja", "Compras", "P&L", "Metas"] as const;
