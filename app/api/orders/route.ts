import { NextResponse } from "next/server";

export async function GET() {
  // Listado de pedidos. Lógica de negocio pendiente.
  return NextResponse.json({ orders: [] });
}

export async function POST() {
  // Crear pedido. Lógica de negocio pendiente.
  return NextResponse.json({ created: false }, { status: 501 });
}

export async function PATCH() {
  // Actualizar pedido. Lógica de negocio pendiente.
  return NextResponse.json({ updated: false }, { status: 501 });
}
