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
  | "sales"
  | "cash"
  | "pnl"
  | "goals"
  | "settings"
  | "customers"
  | "broadcast";

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

export type AdminNavSectionId = "pedidos" | "clientes" | "catalogo" | "finanzas";

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

export const ADMIN_PARAMETROS: AdminNavItem = {
  href: "/admin/parametros",
  label: "Parámetros",
  icon: "settings",
  status: "live",
};

export const ADMIN_VENTAS_HISTORICO: AdminNavItem = {
  href: "/admin/ventas/historico",
  label: "Histórico",
  icon: "pnl",
  status: "live",
};

export const ADMIN_CAJA: AdminNavItem = {
  href: "/admin/caja",
  label: "Caja",
  icon: "cash",
  status: "live",
  children: [
    { href: "/admin/caja/balances", label: "Balances", icon: "cash" },
    { href: "/admin/caja/recuento", label: "Recuento", icon: "cash" },
    { href: "/admin/caja/turnos", label: "Turnos", icon: "history" },
    { href: "/admin/caja/ledger", label: "Ledger", icon: "purchases" },
  ],
};

export const ADMIN_PEDIDOS_NAV: AdminNavItem[] = [
  { href: "/admin/pedidos/supervision", label: "Supervisión", icon: "goals", status: "live" },
  { href: "/admin/historial", label: "Historial de Delivery", icon: "history", status: "live" },
];

export const ADMIN_CLIENTES_NAV: AdminNavItem[] = [
  { href: "/admin/clientes", label: "Clientes", icon: "customers", status: "live" },
  { href: "/admin/clientes/mensajes-masivos", label: "Mensajes masivos", icon: "broadcast", status: "live" },
];

export const ADMIN_CATALOGO_NAV: AdminNavItem[] = [
  { href: "/admin/catalogo/productos", label: "Productos", icon: "products", status: "live" },
  { href: "/admin/catalogo/importar", label: "Importar", icon: "import", status: "live" },
  { href: "/admin/catalogo/imagenes", label: "Imágenes", icon: "images", status: "live" },
  { href: "/admin/catalogo/solicitudes", label: "Solicitudes", icon: "requests", status: "live" },
];

export const ADMIN_FINANZAS_NAV: AdminNavItem[] = [
  ADMIN_CAJA,
  { href: "/admin/ventas", label: "Ventas", icon: "sales", status: "live" },
  ADMIN_VENTAS_HISTORICO,
  { href: "/admin/compras", label: "Compras", icon: "purchases", status: "live" },
  { href: "/admin/proveedores", label: "Proveedores", icon: "suppliers", status: "live" },
  ADMIN_PARAMETROS,
];

/** Live admin links, home first. Flat list of every routed item. */
export const ADMIN_NAV: AdminNavItem[] = [
  ADMIN_HOME,
  ...ADMIN_PEDIDOS_NAV,
  ...ADMIN_CLIENTES_NAV,
  ...ADMIN_CATALOGO_NAV,
  ...ADMIN_FINANZAS_NAV,
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  { id: "pedidos", label: "Pedidos", items: ADMIN_PEDIDOS_NAV },
  { id: "clientes", label: "Clientes", items: ADMIN_CLIENTES_NAV },
  { id: "catalogo", label: "Catálogo", items: ADMIN_CATALOGO_NAV },
  { id: "finanzas", label: "Finanzas", items: ADMIN_FINANZAS_NAV },
];
