import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import { parseStaffOrderItems, replaceStaffOrderItems, STAFF_EDITABLE_ORDER_STATES } from "@/lib/staff-orders";
import type { OrderEstado } from "@/lib/types";
import { confirmOrderToCustomer, notifyCustomerOfOrderStatus } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS: OrderEstado[] = ["en_proceso", "despachada", "completada", "cancelada"];

type PatchBody = {
  estado?: unknown;
  items?: unknown;
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

  const hasEstado = body.estado !== undefined;
  const hasItems = body.items !== undefined;
  if (!hasEstado && !hasItems) {
    return NextResponse.json({ error: "Debes enviar estado o items" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase
    .from("orders")
    .select("id, estado, es_prueba")
    .eq("id", orderId)
    .maybeSingle();

  if (currentError) {
    console.error("[staff] no se pudo leer el pedido", currentError);
    return NextResponse.json({ error: "No pudimos leer el pedido" }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "No encontramos ese pedido" }, { status: 404 });
  }

  if (hasItems) {
    const items = parseStaffOrderItems(body.items);
    if (!items) {
      return NextResponse.json(
        { error: "Debes enviar al menos un producto con cantidad válida" },
        { status: 400 }
      );
    }
    const estado = String(current.estado) as OrderEstado;
    if (!STAFF_EDITABLE_ORDER_STATES.includes(estado)) {
      return NextResponse.json(
        { error: "Este pedido ya no se puede editar" },
        { status: 409 }
      );
    }
    try {
      await replaceStaffOrderItems(orderId, items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No pudimos actualizar el pedido";
      console.error("[staff] no se pudo editar el pedido", error);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!Boolean(current.es_prueba)) {
      try {
        await confirmOrderToCustomer(orderId, true);
      } catch (notifyError) {
        console.error("[staff] no se pudo avisar la edición por WhatsApp", notifyError);
      }
    }
  }

  if (!hasEstado) {
    return NextResponse.json({ ok: true, orderId, updated: true });
  }

  const estado = body.estado;
  if (typeof estado !== "string" || !ALLOWED_STATUS.includes(estado as OrderEstado)) {
    return NextResponse.json(
      { error: "El estado debe ser en_proceso, despachada, completada o cancelada" },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = { estado };
  if (estado === "completada") {
    patch.completada_en = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
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

  try {
    await notifyCustomerOfOrderStatus(orderId, estado as OrderEstado);
  } catch (notifyError) {
    console.error("[staff] no se pudo avisar el cambio de estado por WhatsApp", {
      orderId,
      estado,
      error: notifyError,
    });
  }

  return NextResponse.json({ ok: true, orderId, estado });
}
