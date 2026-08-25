import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getAdminCliente, parseAceptaMarketing, updateAceptaMarketing } from "@/lib/admin-clientes";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { chatId: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const cliente = await getAdminCliente(params.chatId);
    if (!cliente) {
      return NextResponse.json({ error: "No encontramos este cliente" }, { status: 404 });
    }
    return NextResponse.json({ cliente });
  } catch (error) {
    console.error("[admin] cliente detail", error);
    return NextResponse.json({ error: "No pudimos cargar el cliente" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { chatId: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: { aceptaMarketing?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  const aceptaMarketing = parseAceptaMarketing(body.aceptaMarketing);
  if (aceptaMarketing === null) {
    return NextResponse.json({ error: "Indica si acepta marketing." }, { status: 400 });
  }

  try {
    const cliente = await updateAceptaMarketing(params.chatId, aceptaMarketing);
    if (!cliente) {
      return NextResponse.json({ error: "No encontramos este cliente" }, { status: 404 });
    }
    return NextResponse.json({ cliente });
  } catch (error) {
    console.error("[admin] cliente marketing", error);
    return NextResponse.json({ error: "No pudimos guardar el cambio" }, { status: 500 });
  }
}
