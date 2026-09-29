import { NextResponse } from "next/server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import { listPosProducts } from "@/lib/pos-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }
  try {
    const products = await listPosProducts();
    return NextResponse.json({
      products: products.map((product) => ({
        id: product.id,
        nombre: product.nombre,
        marca: product.marca,
        precio: product.precio,
        fotoUrl: product.fotoUrl,
        categoria: product.categoria,
        codigoBarras: product.codigoBarras,
        stock: product.stockBase,
      })),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[pos] productos", error);
    const message = error instanceof Error && error.message ? error.message : "No pudimos cargar el catálogo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
