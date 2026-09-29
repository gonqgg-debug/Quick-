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
        stock: product.stockBase,
      })),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[pos] productos", error);
    return NextResponse.json({ error: "No pudimos cargar el catálogo" }, { status: 500 });
  }
}
