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
  | "broadcast"
  | "report"
  | "invoices";

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

export type AdminNavSectionId = "operacion" | "clientes" | "expansion" | "inventario" | "contabilidad";

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
  href: "/admin/contabilidad/parametros",
  label: "Parámetros",
  icon: "settings",
  status: "live",
};

export const ADMIN_VENTAS_HISTORICO: AdminNavItem = {
  href: "/admin/operacion/ventas/historico",
  label: "Histórico",
  icon: "pnl",
  status: "live",
};

export const ADMIN_CAJA: AdminNavItem = {
  href: "/admin/operacion/caja",
  label: "Caja",
  icon: "cash",
  status: "live",
  children: [
    { href: "/admin/operacion/caja/balances", label: "Balances", icon: "cash" },
    { href: "/admin/operacion/caja/recuento", label: "Recuento", icon: "cash" },
    { href: "/admin/operacion/caja/turnos", label: "Turnos", icon: "history" },
    { href: "/admin/operacion/caja/ledger", label: "Ledger", icon: "purchases" },
  ],
};

export const ADMIN_OPERACION_NAV: AdminNavItem[] = [
  { href: "/admin/operacion/supervision", label: "Supervisión", icon: "goals", status: "live" },
  { href: "/admin/operacion/historial", label: "Historial de Delivery", icon: "history", status: "live" },
  ADMIN_CAJA,
  { href: "/pos", label: "Caja POS", icon: "cash", status: "live" },
  { href: "/admin/ventas/pos", label: "Advertencias POS", icon: "cash", status: "live" },
  { href: "/admin/operacion/ventas", label: "Ventas del día", icon: "sales", status: "live" },
  ADMIN_VENTAS_HISTORICO,
];

export const ADMIN_CLIENTES_NAV: AdminNavItem[] = [
  { href: "/admin/clientes", label: "Clientes", icon: "customers", status: "live" },
  { href: "/admin/clientes/mensajes-masivos", label: "Mensajes masivos", icon: "broadcast", status: "live" },
];

export const ADMIN_EXPANSION_NAV: AdminNavItem[] = [
  { href: "/admin/expansion", label: "Pipeline", icon: "goals", status: "live" },
];

export const ADMIN_INVENTARIO_NAV: AdminNavItem[] = [
  {
    href: "/admin/inventario/productos",
    label: "Productos",
    icon: "products",
    status: "live",
    children: [
      { href: "/admin/inventario/productos", label: "Lista", icon: "products" },
      { href: "/admin/inventario/importar", label: "Importar", icon: "import" },
      { href: "/admin/inventario/imagenes", label: "Imágenes", icon: "images" },
      { href: "/admin/inventario/solicitudes", label: "Solicitudes", icon: "requests" },
    ],
  },
  { href: "/admin/inventario/existencias", label: "Existencias", icon: "products", status: "live" },
  { href: "/admin/inventario/movimientos", label: "Movimientos", icon: "history", status: "live" },
  { href: "/admin/inventario/conteos", label: "Conteos", icon: "cash", status: "live" },
  { href: "/admin/inventario/facturas", label: "Facturas", icon: "invoices", status: "live" },
];

export const ADMIN_REPORTE: AdminNavItem = {
  href: "/admin/contabilidad/reporte",
  label: "Reporte",
  icon: "report",
  status: "live",
};

export const ADMIN_REPORTE_CONTABLE: AdminNavItem = {
  href: "/admin/contabilidad/libro",
  label: "Libro contable",
  icon: "report",
  status: "live",
};

export const ADMIN_CONTABILIDAD_NAV: AdminNavItem[] = [
  { href: "/admin/contabilidad/compras", label: "Cuentas por pagar", icon: "purchases", status: "live" },
  { href: "/admin/contabilidad/proveedores", label: "Proveedores", icon: "suppliers", status: "live" },
  ADMIN_REPORTE,
  ADMIN_REPORTE_CONTABLE,
  ADMIN_PARAMETROS,
];

/** Live admin links, home first. Flat list of every routed item. */
export const ADMIN_NAV: AdminNavItem[] = [
  ADMIN_HOME,
  ...ADMIN_OPERACION_NAV,
  ...ADMIN_CLIENTES_NAV,
  ...ADMIN_EXPANSION_NAV,
  ...ADMIN_INVENTARIO_NAV,
  ...ADMIN_CONTABILIDAD_NAV,
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  { id: "operacion", label: "Operación", items: ADMIN_OPERACION_NAV },
  { id: "clientes", label: "Clientes", items: ADMIN_CLIENTES_NAV },
  { id: "expansion", label: "Expansión", items: ADMIN_EXPANSION_NAV },
  { id: "inventario", label: "Inventario", items: ADMIN_INVENTARIO_NAV },
  { id: "contabilidad", label: "Contabilidad", items: ADMIN_CONTABILIDAD_NAV },
];
