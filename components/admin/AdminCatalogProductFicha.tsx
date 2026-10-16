"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice, parsePrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import { AdminInput, AdminSelect, AdminTextarea, adminLabelClass } from "@/components/admin/AdminField";
import { leerListaProductos } from "@/components/admin/catalogo/lista-guardada";
import { EstadoProducto, FotoProducto, MargenProducto, lineaSecundaria } from "@/components/admin/catalogo/producto-ui";
import { PropuestasRelacionadas } from "@/components/admin/consumo/PropuestasRelacionadas";
import { Aviso, BotonPrincipal, BotonSecundario, Dato, Seccion, fechaCorta } from "@/components/admin/facturas/ui";
import {
  elegirCosto,
  etiquetaCostoFuente,
  formatoMargen,
  isUncategorized,
  margenDe,
  type AdminCatalogProductDetalle,
} from "@/lib/admin-catalog-products-shared";

const SECCIONES = [
  { id: "datos", label: "Datos" },
  { id: "precio", label: "Precio" },
  { id: "compras", label: "Compras" },
  { id: "presentaciones", label: "Presentaciones" },
  { id: "propuestas", label: "Combos y promos" },
];

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function escribiendo(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function formatoUnidades(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${text} ${rounded === 1 ? "unidad" : "unidades"}`;
}

export function AdminCatalogProductFicha({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const volver = query ? `/admin/catalogo/productos?${query}` : "/admin/catalogo/productos";
  const [detalle, setDetalle] = useState<AdminCatalogProductDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listaIds, setListaIds] = useState<string[]>([]);

  useEffect(() => {
    setListaIds(leerListaProductos()?.ids ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetalle(null);
    void fetch(`/api/admin/catalogo/productos/${id}`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const body = (await response.json().catch(() => null)) as (AdminCatalogProductDetalle & { error?: string }) | null;
        if (!response.ok || !body?.product) {
          throw new Error(body?.error || "No pudimos abrir el producto");
        }
        if (!cancelled) {
          setDetalle(body);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "No pudimos abrir el producto");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const nav = useMemo(() => {
    const index = listaIds.indexOf(id);
    return {
      anterior: index > 0 ? listaIds[index - 1] : null,
      siguiente: index >= 0 && index < listaIds.length - 1 ? listaIds[index + 1] : null,
      posicion: index >= 0 ? index + 1 : null,
      total: listaIds.length,
    };
  }, [listaIds, id]);

  function ir(destino: string) {
    router.push(`/admin/catalogo/productos/${destino}${query ? `?${query}` : ""}`);
  }

  if (loading && !detalle) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E7EBE4] px-6 py-16 text-center">
        <p className="font-display text-lg font-bold">No pudimos abrir el producto</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">{error ?? "Puede que ya no exista."}</p>
        <Link href={volver} className="mt-4 inline-block text-sm font-bold" style={{ color: brand.blue }}>
          Volver a productos
        </Link>
      </div>
    );
  }

  return (
    <Editor
      key={detalle.product.id}
      detalle={detalle}
      volver={volver}
      nav={nav}
      onIr={ir}
      onSaved={(next) => setDetalle(next)}
    />
  );
}

function Editor({
  detalle,
  volver,
  nav,
  onIr,
  onSaved,
}: {
  detalle: AdminCatalogProductDetalle;
  volver: string;
  nav: { anterior: string | null; siguiente: string | null; posicion: number | null; total: number };
  onIr: (id: string) => void;
  onSaved: (detalle: AdminCatalogProductDetalle) => void;
}) {
  const router = useRouter();
  const product = detalle.product;
  const [nombre, setNombre] = useState(product.nombre);
  const [marca, setMarca] = useState(product.marca ?? "");
  const [descripcion, setDescripcion] = useState(product.descripcion ?? "");
  const [categoria, setCategoria] = useState(isUncategorized(product.categoria) ? "" : product.categoria);
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [categoriaModo, setCategoriaModo] = useState<"select" | "nueva">("select");
  const [precio, setPrecio] = useState(String(product.precio));
  const [tasa, setTasa] = useState(product.tasaItbis === 0 || product.tasaItbis === 16 ? String(product.tasaItbis) : "18");
  const [costoManual, setCostoManual] = useState(product.costoManual == null ? "" : String(product.costoManual));
  const [activo, setActivo] = useState(product.activo);
  const [fotoUrl, setFotoUrl] = useState(product.fotoUrl);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<string | null>(null);

  const categoriaResuelta = categoriaModo === "nueva" ? categoriaNueva.trim() : categoria.trim();
  const categoriaOriginal = isUncategorized(product.categoria) ? "" : product.categoria;
  const precioNumero = parsePrice(precio);
  const costoNumero = costoManual.trim() === "" ? null : parsePrice(costoManual);
  const costoDistinto = !mismoDinero(costoNumero, product.costoManual) || (costoManual.trim() !== "" && costoNumero == null);
  const dirty =
    Boolean(imageFile) ||
    nombre.trim() !== product.nombre.trim() ||
    marca.trim() !== (product.marca ?? "") ||
    descripcion.trim() !== (product.descripcion ?? "") ||
    categoriaResuelta !== categoriaOriginal ||
    (precioNumero == null ? precio.trim() !== String(product.precio) : precioNumero !== product.precio) ||
    activo !== product.activo ||
    costoDistinto ||
    tasa !== (product.tasaItbis === 0 || product.tasaItbis === 16 ? String(product.tasaItbis) : "18");

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (!dirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function confirmarSalida(): boolean {
    if (!dirty) {
      return true;
    }
    return window.confirm("Hay cambios sin guardar. ¿Descartarlos?");
  }

  function salir() {
    if (!confirmarSalida()) {
      return;
    }
    router.push(volver);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || escribiendo(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const seguir = () => !dirty || window.confirm("Hay cambios sin guardar. ¿Descartarlos?");
      if (key === "j" && nav.siguiente) {
        if (!seguir()) {
          return;
        }
        event.preventDefault();
        onIr(nav.siguiente);
      } else if (key === "k" && nav.anterior) {
        if (!seguir()) {
          return;
        }
        event.preventDefault();
        onIr(nav.anterior);
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (seguir()) {
          router.push(volver);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, nav.anterior, nav.siguiente, onIr, router, volver]);

  function acceptFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!PHOTO_TYPES.has(mime)) {
      setError("Usa JPG, PNG o WebP");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("La imagen pesa más de 5 MB");
      return;
    }
    setError(null);
    setSaved(false);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      const next = URL.createObjectURL(file);
      previewRef.current = next;
      return next;
    });
    setImageFile(file);
  }

  async function guardar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setError("El nombre no puede quedar vacío");
      return;
    }
    if (!categoriaResuelta) {
      setError("La categoría no puede quedar vacía");
      return;
    }
    if (precioNumero == null) {
      setError("Precio inválido");
      return;
    }
    if (costoManual.trim() && costoNumero == null) {
      setError("Costo inválido");
      return;
    }
    if (product.activo && !activo && !window.confirm("Este producto dejará de verse en el catálogo público. ¿Desactivar?")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let nextFoto = fotoUrl;
      if (imageFile) {
        const body = new FormData();
        body.append("productId", product.id);
        body.append("file", imageFile);
        const response = await fetch("/api/admin/catalogo/imagenes/upload", { method: "POST", credentials: "include", body });
        const payload = (await response.json().catch(() => null)) as { fotoUrl?: string; error?: string } | null;
        if (!response.ok || !payload?.fotoUrl) {
          throw new Error(payload?.error || "No pudimos subir la imagen");
        }
        nextFoto = payload.fotoUrl;
      }
      const patch: Record<string, unknown> = { id: product.id };
      if (nombreLimpio !== product.nombre.trim()) {
        patch.nombre = nombreLimpio;
      }
      if (marca.trim() !== (product.marca ?? "")) {
        patch.marca = marca.trim() || null;
      }
      if (descripcion.trim() !== (product.descripcion ?? "")) {
        patch.descripcion = descripcion.trim();
      }
      if (categoriaResuelta !== categoriaOriginal) {
        patch.categoria = categoriaResuelta;
      }
      if (precioNumero !== product.precio) {
        patch.precio = precioNumero;
      }
      if (!mismoDinero(costoNumero, product.costoManual)) {
        patch.costo = costoNumero;
      }
      const tasaGuardada = product.tasaItbis === 0 || product.tasaItbis === 16 ? String(product.tasaItbis) : "18";
      if (tasa !== tasaGuardada) {
        patch.tasaItbis = Number(tasa);
      }
      if (activo !== product.activo) {
        patch.activo = activo;
      }
      let nextProduct = { ...product, fotoUrl: nextFoto };
      if (Object.keys(patch).length > 1) {
        const response = await fetch("/api/admin/catalogo/productos", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const payload = (await response.json().catch(() => null)) as { product?: AdminCatalogProductDetalle["product"]; error?: string } | null;
        if (!response.ok || !payload?.product) {
          throw new Error(payload?.error || "No pudimos guardar");
        }
        nextProduct = { ...payload.product, fotoUrl: nextFoto || payload.product.fotoUrl };
      }
      setFotoUrl(nextFoto);
      setImageFile(null);
      setImagePreview(null);
      setSaved(true);
      onSaved({ ...detalle, product: nextProduct });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar");
    } finally {
      setSaving(false);
    }
  }

  const preview = imagePreview || fotoUrl;
  const costoVigente = elegirCosto({
    facturaCosto: product.costoFactura,
    facturaEn: product.costoFacturaClave ?? product.costoFacturaEn,
    manualCosto: costoNumero,
    manualEn: costoNumero == null ? null : mismoDinero(costoNumero, product.costoManual) ? product.costoManualEn : new Date().toISOString(),
    manualFuente: costoNumero == null ? null : mismoDinero(costoNumero, product.costoManual) ? product.costoManualFuente : "admin",
  });
  const tasaVista = tasa === "0" || tasa === "16" || tasa === "18" ? Number(tasa) : 18;
  const margenVista = margenDe(
    precioNumero ?? product.precio,
    costoManual.trim() && costoNumero == null ? product.costo : costoVigente.costo,
    tasaVista,
  );
  const compra = detalle.compra;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-[#E7EBE4] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" onClick={salir} className="font-semibold text-brand-muted hover:text-brand-ink">
            ← Productos
          </button>
          <div className="flex items-center gap-1">
            {nav.posicion != null ? (
              <span className="mr-2 text-xs tabular-nums text-brand-muted">
                {nav.posicion} de {nav.total}
              </span>
            ) : null}
            <NavButton label="Anterior" tecla="K" disabled={!nav.anterior} onClick={() => nav.anterior && confirmarSalida() && onIr(nav.anterior)} />
            <NavButton label="Siguiente" tecla="J" disabled={!nav.siguiente} onClick={() => nav.siguiente && confirmarSalida() && onIr(nav.siguiente)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div>
            <FotoProducto src={preview} size="ficha" />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                acceptFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 text-xs font-bold" style={{ color: brand.blue }}>
              Cambiar imagen
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold leading-tight">{nombre.trim() || product.nombre}</h1>
            <p className="mt-1 text-sm text-brand-muted">{lineaSecundaria({ ...product, marca: marca.trim() || null, categoria: categoriaResuelta || product.categoria }) || "Sin marca ni código"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <EstadoProducto activo={activo} />
              <MargenProducto margen={margenVista} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saved && !dirty ? <span className="text-sm font-bold" style={{ color: brand.green }}>Guardado</span> : null}
            <BotonPrincipal onClick={() => void guardar()} disabled={saving || !dirty}>
              {saving ? "Guardando…" : "Guardar"}
            </BotonPrincipal>
          </div>
        </div>
        {error ? (
          <div className="mt-3">
            <Aviso>{error}</Aviso>
          </div>
        ) : null}
      </header>

      <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto rounded-xl bg-white/95 px-1 py-1.5 backdrop-blur" aria-label="Secciones del producto">
        {SECCIONES.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-brand-muted hover:bg-[#F3F4F6] hover:text-brand-ink">
            {item.label}
          </a>
        ))}
      </nav>

      <Seccion id="datos" titulo="Datos">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${adminLabelClass} sm:col-span-2`}>
            Nombre
            <AdminInput value={nombre} onChange={(event) => { setNombre(event.target.value); setSaved(false); }} />
          </label>
          <label className={adminLabelClass}>
            Marca
            <AdminInput value={marca} onChange={(event) => { setMarca(event.target.value); setSaved(false); }} />
          </label>
          <label className={adminLabelClass}>
            Categoría
            {categoriaModo === "nueva" ? (
              <span className="mt-1.5 flex gap-2">
                <AdminInput bare value={categoriaNueva} placeholder="Nueva categoría" onChange={(event) => { setCategoriaNueva(event.target.value); setSaved(false); }} />
                <button type="button" className="shrink-0 text-xs font-bold text-brand-muted" onClick={() => setCategoriaModo("select")}>
                  Cancelar
                </button>
              </span>
            ) : (
              <AdminSelect
                value={categoria}
                onChange={(event) => {
                  setSaved(false);
                  if (event.target.value === "__new__") {
                    setCategoriaModo("nueva");
                    setCategoriaNueva("");
                    return;
                  }
                  setCategoria(event.target.value);
                }}
              >
                <option value="" disabled>
                  Elegir…
                </option>
                {Array.from(new Set([categoriaOriginal, ...detalle.categories].filter((item) => item && !isUncategorized(item)))).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                <option value="__new__">Crear nueva…</option>
              </AdminSelect>
            )}
          </label>
          <label className={`${adminLabelClass} sm:col-span-2`}>
            Descripción
            <AdminTextarea rows={4} value={descripcion} onChange={(event) => { setDescripcion(event.target.value); setSaved(false); }} />
          </label>
          <dl className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <Dato label="Código Odoo" value={product.codigoOdoo} />
            <Dato label="Código de barras" value={product.codigoBarras} />
          </dl>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-semibold">{activo ? "Visible en el catálogo" : "Oculto del catálogo"}</p>
          <BotonSecundario onClick={() => { setActivo((current) => !current); setSaved(false); }}>
            {activo ? "Desactivar" : "Activar"}
          </BotonSecundario>
        </div>
      </Seccion>

      <Seccion id="precio" titulo="Precio">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={adminLabelClass}>
            Precio de venta
            <span className="relative mt-1.5 block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold" style={{ color: brand.orange }}>
                RD$
              </span>
              <AdminInput bare className="pl-12 font-semibold tabular-nums" inputMode="decimal" value={precio} onChange={(event) => { setPrecio(event.target.value); setSaved(false); }} />
            </span>
          </label>
          <dl className="contents">
            <Dato
              label="Costo en uso"
              value={
                costoVigente.costo == null
                  ? "Sin costo"
                  : `${formatPrice(costoVigente.costo)}${costoVigente.fuente ? ` · ${etiquetaCostoFuente(costoVigente.fuente)}` : ""}`
              }
              strong
            />
            <Dato label="Margen" value={margenVista == null ? "Sin costo" : formatoMargen(margenVista)} strong />
          </dl>
          <label className={adminLabelClass}>
            ITBIS incluido
            <AdminSelect className="mt-1.5" value={tasa} onChange={(event) => { setTasa(event.target.value); setSaved(false); }}>
              <option value="18">18%</option>
              <option value="16">16%</option>
              <option value="0">0% exento</option>
            </AdminSelect>
          </label>
          <label className={adminLabelClass}>
            Costo manual
            <span className="relative mt-1.5 block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold" style={{ color: brand.orange }}>
                RD$
              </span>
              <AdminInput
                bare
                className="pl-12 font-semibold tabular-nums"
                inputMode="decimal"
                value={costoManual}
                placeholder="Vacío para quitarlo"
                onChange={(event) => {
                  setCostoManual(event.target.value);
                  setSaved(false);
                }}
              />
            </span>
          </label>
        </div>
        <p className="mt-3 text-sm text-brand-muted">
          El precio de venta ya incluye el ITBIS. El costo, de factura o manual, también lo incluye. Se muestra el más reciente entre la factura
          {product.costoFactura == null ? "" : ` (${formatPrice(product.costoFactura)}${product.costoFacturaEn ? `, ${fechaCorta(product.costoFacturaEn)}` : ""})`} y este costo manual. Guardarlo aquí deja la fuente como manual.
        </p>
      </Seccion>

      <Seccion id="compras" titulo="Compras" extra={compra ? <Link href={`/admin/facturas/${compra.facturaId}`} className="text-sm font-bold" style={{ color: brand.blue }}>Ver factura</Link> : null}>
        {product.proveedores.length === 0 && !compra ? (
          <p className="text-sm text-brand-muted">Todavía no hay una compra ligada a este producto.</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Dato label="Última compra" value={compra ? fechaCorta(compra.fecha) : fechaCorta(product.costoFacturaEn)} />
              <Dato label="Proveedor" value={compra?.proveedor ?? null} />
              <Dato label="Costo de la factura" value={product.costoFactura == null ? "Sin costo" : formatPrice(product.costoFactura)} strong />
            </dl>
            {product.proveedores.length > 0 ? (
              <ul className="divide-y divide-[#E7EBE4] border-t border-[#E7EBE4]">
                {product.proveedores.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="font-semibold">{item.nombre}</span>
                    <span className="tabular-nums text-brand-muted">{item.ultimaCompra ? fechaCorta(item.ultimaCompra) : "—"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </Seccion>

      <Seccion id="presentaciones" titulo="Presentaciones">
        {detalle.presentaciones.length === 0 ? (
          <p className="text-sm text-brand-muted">Todavía no hay caja, fardo o paquete guardados.</p>
        ) : (
          <ul className="divide-y divide-[#E7EBE4]">
            {detalle.presentaciones.map((item) => (
              <li key={`${item.presentacion}-${item.proveedor ?? "general"}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                <span className="font-semibold">{item.etiqueta}</span>
                <span className="tabular-nums">{formatoUnidades(item.unidades)}</span>
                <span className="text-brand-muted">{item.proveedor ?? "Cualquier proveedor"}</span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion id="propuestas" titulo="Combos y promos">
        <PropuestasRelacionadas productoId={product.id} />
      </Seccion>
    </div>
  );
}

function mismoDinero(left: number | null, right: number | null): boolean {
  if (left == null || right == null) {
    return left == null && right == null;
  }
  return Math.round(left * 100) === Math.round(right * 100);
}

function NavButton({ label, tecla, disabled, onClick }: { label: string; tecla: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-40">
      {label}
      <span className="ml-1 text-brand-muted">{tecla}</span>
    </button>
  );
}
