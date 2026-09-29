import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  listAdminCatalogProductIds,
  listAdminCatalogProducts,
  parseCatalogProductFilters,
  updateAdminCatalogProduct,
} from "@/lib/admin-catalog-products";
import type { AdminCatalogProduct } from "@/lib/admin-catalog-products-shared";
import { normalizarTienda } from "@/lib/inventario/costos";
import { existenciasPorProducto, guardarPuntoReorden, schemaInventarioFalta } from "@/lib/inventario/movimientos";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function conInventario(products: AdminCatalogProduct[], tienda: string): Promise<AdminCatalogProduct[]> {
  try {
    const stock = await existenciasPorProducto(
      products.map((product) => product.id),
      tienda
    );
    return products.map((product) => {
      const existencia = stock.get(product.id);
      return {
        ...product,
        existencia: existencia ? existencia.cantidad : null,
        costoPromedio: existencia?.costoPromedio ?? null,
        ultimoCosto: existencia?.ultimoCosto ?? null,
        puntoReorden: existencia?.puntoReorden ?? null,
      };
    });
  } catch (error) {
    if (schemaInventarioFalta(error)) {
      return products;
    }
    throw error;
  }
}

async function leerProducto(id: string): Promise<AdminCatalogProduct | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, nombre, marca, categoria, precio, codigo_odoo, codigo_barras, foto_url, activo")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    id: String(data.id),
    nombre: String(data.nombre),
    marca: data.marca ? String(data.marca) : null,
    categoria: String(data.categoria ?? ""),
    precio: toMoney(data.precio),
    codigoOdoo: data.codigo_odoo ? String(data.codigo_odoo) : null,
    codigoBarras: data.codigo_barras ? String(data.codigo_barras) : null,
    fotoUrl: data.foto_url ? String(data.foto_url) : null,
    activo: Boolean(data.activo),
    existencia: null,
    costoPromedio: null,
    ultimoCosto: null,
    puntoReorden: null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const filters = parseCatalogProductFilters(request.nextUrl.searchParams);
    if (request.nextUrl.searchParams.get("ids") === "1") {
      const ids = await listAdminCatalogProductIds(filters);
      return NextResponse.json({ ids, total: ids.length });
    }
    const result = await listAdminCatalogProducts(filters);
    const tienda = normalizarTienda(request.nextUrl.searchParams.get("tienda"));
    return NextResponse.json({ ...result, tienda, products: await conInventario(result.products, tienda) });
  } catch (error) {
    console.error("[admin] catalog products list", error);
    return NextResponse.json({ error: "No pudimos cargar los productos" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      id?: unknown;
      nombre?: unknown;
      marca?: unknown;
      categoria?: unknown;
      precio?: unknown;
      activo?: unknown;
      puntoReorden?: unknown;
      tienda?: unknown;
    };
    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "Falta el producto" }, { status: 400 });
    }
    const tienda = normalizarTienda(body.tienda);
    const tocaProducto = ["nombre", "marca", "categoria", "precio", "activo"].some((key) => Object.prototype.hasOwnProperty.call(body, key));
    if (!tocaProducto && body.puntoReorden === undefined) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }
    const product = tocaProducto
      ? await updateAdminCatalogProduct({
          id: body.id,
          nombre: body.nombre,
          marca: body.marca,
          categoria: body.categoria,
          precio: body.precio,
          activo: body.activo,
        })
      : await leerProducto(body.id);
    if (!product) {
      return NextResponse.json({ error: "No encontramos ese producto" }, { status: 404 });
    }
    if (body.puntoReorden !== undefined) {
      const punto = typeof body.puntoReorden === "number" ? body.puntoReorden : Number(body.puntoReorden);
      await guardarPuntoReorden(body.id, tienda, punto);
    }
    const [conStock] = await conInventario([product], tienda);
    return NextResponse.json({ product: conStock ?? product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar";
    console.error("[admin] catalog product update", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
