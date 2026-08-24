export type AdminNavIcon =
  | "home"
  | "history"
  | "catalog"
  | "products"
  | "import"
  | "images"
  | "requests"
  | "purchases"
  | "suppliers"
  | "cash"
  | "pnl"
  | "goals";

export type AdminNavChild = {
  href: string;
  label: string;
  icon: AdminNavIcon;
};

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
  /** `live` is routed today. `slot` is reserved in the menu for the next build. */
  status: "live" | "slot";
  children?: AdminNavChild[];
};

export type AdminNavSectionId = "admin" | "delivery" | "compras" | "soon";

export type AdminNavSection = {
  id: AdminNavSectionId;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_HOME: AdminNavItem = {
  href: "/admin",
  label: "Inicio",
  icon: "home",
  status: "live",
};

export const ADMIN_DELIVERY_NAV: AdminNavItem[] = [
  { href: "/admin/historial", label: "Historial de Delivery", icon: "history", status: "live" },
  {
    href: "/admin/catalogo",
    label: "Catálogo",
    icon: "catalog",
    status: "live",
    children: [
      { href: "/admin/catalogo/productos", label: "Productos", icon: "products" },
      { href: "/admin/catalogo/importar", label: "Importar", icon: "import" },
      { href: "/admin/catalogo/imagenes", label: "Imágenes", icon: "images" },
      { href: "/admin/catalogo/solicitudes", label: "Solicitudes", icon: "requests" },
    ],
  },
];

export const ADMIN_COMPRAS_NAV: AdminNavItem[] = [
  { href: "/admin/compras", label: "Compras", icon: "purchases", status: "live" },
  { href: "/admin/proveedores", label: "Proveedores", icon: "suppliers", status: "live" },
];

/** Live admin links, home first. Used by the mobile nav. */
export const ADMIN_NAV: AdminNavItem[] = [ADMIN_HOME, ...ADMIN_DELIVERY_NAV, ...ADMIN_COMPRAS_NAV];

/** Future sections — visible in the menu, not routed yet. */
export const ADMIN_SOON_NAV: AdminNavItem[] = [
  { href: "#caja", label: "Caja", icon: "cash", status: "slot" },
  { href: "#pnl", label: "P&L", icon: "pnl", status: "slot" },
  { href: "#metas", label: "Metas", icon: "goals", status: "slot" },
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  { id: "admin", label: "Admin", items: [ADMIN_HOME] },
  { id: "delivery", label: "Delivery", items: ADMIN_DELIVERY_NAV },
  { id: "compras", label: "Compras", items: ADMIN_COMPRAS_NAV },
  { id: "soon", label: "Próximamente", items: ADMIN_SOON_NAV },
];
