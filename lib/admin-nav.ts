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
  | "invoices"
  | "decisions"
  | "exceptions"
  | "close"
  | "consumo";

export type AdminNavChild = {
  href: string;
  label: string;
  icon: AdminNavIcon;
};

export type AdminNavGroup = "caja" | "ventas";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
  /** `live` is routed today. `slot` is reserved in the menu for the next build. */
  status: "live" | "slot";
  /** Collapsible submenu. Only items with children set this. */
  group?: AdminNavGroup;
  children?: AdminNavChild[];
};

export type AdminNavSectionId =
  | "pedidos"
  | "clientes"
  | "expansion"
  | "catalogo"
  | "consumo"
  | "finanzas"
  | "contabilidad";

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
  group: "caja",
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

export const ADMIN_EXPANSION_NAV: AdminNavItem[] = [
  { href: "/admin/expansion", label: "Pipeline", icon: "goals", status: "live" },
];

export const ADMIN_CATALOGO_NAV: AdminNavItem[] = [
  { href: "/admin/catalogo/productos", label: "Productos", icon: "products", status: "live" },
  { href: "/admin/catalogo/importar", label: "Importar", icon: "import", status: "live" },
  { href: "/admin/catalogo/imagenes", label: "Imágenes", icon: "images", status: "live" },
  { href: "/admin/catalogo/solicitudes", label: "Solicitudes", icon: "requests", status: "live" },
];

export const ADMIN_CONSUMO_NAV: AdminNavItem[] = [
  { href: "/admin/consumo", label: "Resumen", icon: "consumo", status: "live" },
  { href: "/admin/consumo/productos", label: "Productos", icon: "products", status: "live" },
  { href: "/admin/consumo/horarios", label: "Horarios", icon: "history", status: "live" },
  { href: "/admin/consumo/canasta", label: "Canasta", icon: "catalog", status: "live" },
  { href: "/admin/consumo/miles", label: "Miles", icon: "goals", status: "live" },
  { href: "/admin/consumo/calidad", label: "Calidad", icon: "exceptions", status: "live" },
];

export const ADMIN_REPORTE: AdminNavItem = {
  href: "/admin/reporte",
  label: "Reporte",
  icon: "report",
  status: "live",
};

export const ADMIN_REPORTE_CONTABLE: AdminNavItem = {
  href: "/admin/reporte/contable",
  label: "Contable",
  icon: "report",
  status: "live",
};

export const ADMIN_VENTAS: AdminNavItem = {
  href: "/admin/ventas",
  label: "Ventas",
  icon: "sales",
  status: "live",
  group: "ventas",
  children: [
    { href: "/admin/ventas", label: "Del día", icon: "sales" },
    {
      href: ADMIN_VENTAS_HISTORICO.href,
      label: ADMIN_VENTAS_HISTORICO.label,
      icon: ADMIN_VENTAS_HISTORICO.icon,
    },
  ],
};

/** Day-to-day money: cash, sales, payables, suppliers. */
export const ADMIN_FINANZAS_NAV: AdminNavItem[] = [
  ADMIN_CAJA,
  { href: "/admin/banco", label: "Banco", icon: "cash", status: "live" },
  ADMIN_VENTAS,
  { href: "/admin/compras", label: "Compras", icon: "purchases", status: "live" },
  { href: "/admin/proveedores", label: "Proveedores", icon: "suppliers", status: "live" },
  ADMIN_PARAMETROS,
];

/** Agent accounting: fichas, decisions, exceptions, close, and Robert's reports. */
export const ADMIN_CONTABILIDAD_NAV: AdminNavItem[] = [
  { href: "/admin/decisiones", label: "Decisiones", icon: "decisions", status: "live" },
  { href: "/admin/facturas", label: "Facturas", icon: "invoices", status: "live" },
  { href: "/admin/excepciones", label: "Excepciones", icon: "exceptions", status: "live" },
  { href: "/admin/cierre", label: "Cierre", icon: "close", status: "live" },
  ADMIN_REPORTE,
  ADMIN_REPORTE_CONTABLE,
];

/** Live admin links, home first. Flat list of every routed item. */
export const ADMIN_NAV: AdminNavItem[] = [
  ADMIN_HOME,
  ...ADMIN_PEDIDOS_NAV,
  ...ADMIN_CLIENTES_NAV,
  ...ADMIN_EXPANSION_NAV,
  ...ADMIN_CATALOGO_NAV,
  ...ADMIN_CONSUMO_NAV,
  ...ADMIN_FINANZAS_NAV,
  ...ADMIN_CONTABILIDAD_NAV,
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  { id: "pedidos", label: "Pedidos", items: ADMIN_PEDIDOS_NAV },
  { id: "clientes", label: "Clientes", items: ADMIN_CLIENTES_NAV },
  { id: "expansion", label: "Expansión", items: ADMIN_EXPANSION_NAV },
  { id: "catalogo", label: "Catálogo", items: ADMIN_CATALOGO_NAV },
  { id: "consumo", label: "Consumo", items: ADMIN_CONSUMO_NAV },
  { id: "finanzas", label: "Finanzas", items: ADMIN_FINANZAS_NAV },
  { id: "contabilidad", label: "Contabilidad", items: ADMIN_CONTABILIDAD_NAV },
];
