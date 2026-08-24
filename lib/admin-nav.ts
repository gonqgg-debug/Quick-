export type AdminNavChild = {
  href: string;
  label: string;
};

export type AdminNavItem = {
  href: string;
  label: string;
  /** `live` is routed today. `slot` is reserved in the menu for the next build. */
  status: "live" | "slot";
  children?: AdminNavChild[];
};

export const ADMIN_HOME: AdminNavItem = {
  href: "/admin",
  label: "Inicio",
  status: "live",
};

export const ADMIN_DELIVERY_NAV: AdminNavItem[] = [
  { href: "/admin/historial", label: "Historial de Delivery", status: "live" },
  {
    href: "/admin/catalogo",
    label: "Catálogo",
    status: "live",
    children: [
      { href: "/admin/catalogo/productos", label: "Productos" },
      { href: "/admin/catalogo/importar", label: "Importar" },
      { href: "/admin/catalogo/imagenes", label: "Imágenes" },
      { href: "/admin/catalogo/solicitudes", label: "Solicitudes" },
    ],
  },
];

export const ADMIN_COMPRAS_NAV: AdminNavItem[] = [
  { href: "/admin/compras", label: "Compras", status: "live" },
  { href: "/admin/proveedores", label: "Proveedores", status: "live" },
];

/** Live admin links, home first. Used by the mobile nav. */
export const ADMIN_NAV: AdminNavItem[] = [ADMIN_HOME, ...ADMIN_DELIVERY_NAV, ...ADMIN_COMPRAS_NAV];

/** Future sections — visible in the menu, not routed yet. */
export const ADMIN_SOON_NAV = ["Caja", "P&L", "Metas"] as const;
