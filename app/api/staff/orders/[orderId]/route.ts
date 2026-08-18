import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import type { OrderEstado } from "@/lib/types";
import { notifyOrderDispatched } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS: OrderEstado[] = ["en_proceso", "despachada", "completada", "cancelada"];

type PatchBody = {
  estado?: unknown;
};

export async function PATCH(
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

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const estado = body.estado;
  if (typeof estado !== "string" || !ALLOWED_STATUS.includes(estado as OrderEstado)) {
    return NextResponse.json(
      { error: "El estado debe ser en_proceso, despachada, completada o cancelada" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ estado })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[staff] no se pudo actualizar el pedido", error);
    return NextResponse.json({ error: "No pudimos actualizar el pedido" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "No encontramos ese pedido" }, { status: 404 });
  }

  if (estado === "despachada") {
    try {
      await notifyOrderDispatched(orderId);
    } catch (notifyError) {
      console.error("[staff] no se pudo avisar el despacho por WhatsApp", notifyError);
    }
  }

  return NextResponse.json({ ok: true, orderId, estado });
}
