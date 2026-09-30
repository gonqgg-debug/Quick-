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

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
  /** `live` is routed today. `slot` is reserved in the menu for the next build. */
  status: "live" | "slot";
  /** Paths that keep this row highlighted besides its own href. */
  activePrefixes?: readonly string[];
};

export type AdminNavSectionId = "operacion" | "inventario" | "contabilidad" | "mas";

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

export const ADMIN_VENTAS_TABS = [
  { href: "/admin/operacion/ventas", label: "Del día" },
  { href: "/admin/operacion/ventas/historico", label: "Histórico" },
] as const;

export const ADMIN_EXISTENCIAS_TABS = [
  { href: "/admin/inventario/existencias", label: "En mano" },
  { href: "/admin/inventario/movimientos", label: "Movimientos" },
] as const;

export const ADMIN_REPORTE_TABS = [
  { href: "/admin/contabilidad/reporte", label: "Resumen" },
  { href: "/admin/contabilidad/libro", label: "Libro" },
] as const;

export const ADMIN_AJUSTES_TABS = [
  { href: "/admin/contabilidad/fiscal", label: "Datos fiscales" },
  { href: "/admin/contabilidad/parametros", label: "Parámetros" },
] as const;

export const ADMIN_PRODUCTO_TABS = [
  { href: "/admin/inventario/productos", label: "Lista" },
  { href: "/admin/inventario/importar", label: "Importar" },
  { href: "/admin/inventario/imagenes", label: "Imágenes" },
  { href: "/admin/inventario/solicitudes", label: "Solicitudes" },
] as const;

export const ADMIN_OPERACION_NAV: AdminNavItem[] = [
  { href: "/admin/operacion/supervision", label: "Supervisión", icon: "goals", status: "live" },
  {
    href: "/admin/operacion/historial",
    label: "Delivery",
    icon: "history",
    status: "live",
    activePrefixes: ["/admin/operacion/historial", "/admin/historial"],
  },
  {
    href: "/admin/operacion/caja",
    label: "Caja",
    icon: "cash",
    status: "live",
    activePrefixes: ["/admin/operacion/caja", "/admin/caja", "/admin/ventas/pos"],
  },
  {
    href: "/admin/operacion/ventas",
    label: "Ventas",
    icon: "sales",
    status: "live",
    activePrefixes: ["/admin/operacion/ventas"],
  },
];

export const ADMIN_INVENTARIO_NAV: AdminNavItem[] = [
  {
    href: "/admin/inventario/productos",
    label: "Productos",
    icon: "products",
    status: "live",
    activePrefixes: [
      "/admin/inventario/productos",
      "/admin/inventario/importar",
      "/admin/inventario/imagenes",
      "/admin/inventario/solicitudes",
    ],
  },
  {
    href: "/admin/inventario/existencias",
    label: "Existencias",
    icon: "products",
    status: "live",
    activePrefixes: ["/admin/inventario/existencias", "/admin/inventario/movimientos"],
  },
  { href: "/admin/inventario/conteos", label: "Conteos", icon: "cash", status: "live" },
  { href: "/admin/inventario/facturas", label: "Facturas", icon: "invoices", status: "live" },
];

export const ADMIN_CONTABILIDAD_NAV: AdminNavItem[] = [
  { href: "/admin/contabilidad/compras", label: "Por pagar", icon: "purchases", status: "live" },
  { href: "/admin/contabilidad/proveedores", label: "Proveedores", icon: "suppliers", status: "live" },
  {
    href: "/admin/contabilidad/reporte",
    label: "Reportes",
    icon: "report",
    status: "live",
    activePrefixes: ["/admin/contabilidad/reporte", "/admin/contabilidad/libro", "/admin/reporte"],
  },
];

export const ADMIN_MAS_NAV: AdminNavItem[] = [
  { href: "/admin/clientes", label: "Clientes", icon: "customers", status: "live" },
  { href: "/admin/clientes/mensajes-masivos", label: "Mensajes", icon: "broadcast", status: "live" },
  { href: "/admin/expansion", label: "Expansión", icon: "goals", status: "live" },
  {
    href: "/admin/contabilidad/fiscal",
    label: "Ajustes",
    icon: "settings",
    status: "live",
    activePrefixes: ["/admin/contabilidad/fiscal", "/admin/contabilidad/parametros", "/admin/parametros"],
  },
];

/** Live admin links, home first. Flat list of every routed item. */
export const ADMIN_NAV: AdminNavItem[] = [
  ADMIN_HOME,
  ...ADMIN_OPERACION_NAV,
  ...ADMIN_INVENTARIO_NAV,
  ...ADMIN_CONTABILIDAD_NAV,
  ...ADMIN_MAS_NAV,
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  { id: "operacion", label: "Operación", items: ADMIN_OPERACION_NAV },
  { id: "inventario", label: "Inventario", items: ADMIN_INVENTARIO_NAV },
  { id: "contabilidad", label: "Contabilidad", items: ADMIN_CONTABILIDAD_NAV },
  { id: "mas", label: "Más", items: ADMIN_MAS_NAV },
];

export function navItemActive(pathname: string, item: Pick<AdminNavItem, "href" | "activePrefixes">): boolean {
  if (item.href === "/admin") {
    return pathname === "/admin";
  }
  if (item.href === "/admin/clientes") {
    if (pathname.startsWith("/admin/clientes/mensajes-masivos")) {
      return false;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  const prefixes = item.activePrefixes ?? [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
