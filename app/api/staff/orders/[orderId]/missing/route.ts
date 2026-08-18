import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import { reportMissingItem } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type MissingBody = {
  productId?: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const orderId = params.orderId?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "Falta el pedido" }, { status: 400 });
  }

  let body: MissingBody;
  try {
    body = (await request.json()) as MissingBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  if (!productId) {
    return NextResponse.json({ error: "Falta productId" }, { status: 400 });
  }

  try {
    const found = await reportMissingItem(orderId, productId);
    if (!found) {
      return NextResponse.json(
        { error: "No encontramos ese producto en el pedido" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("[staff] error al marcar faltante", error);
    return NextResponse.json(
      { error: "No pudimos marcar el producto como faltante" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
