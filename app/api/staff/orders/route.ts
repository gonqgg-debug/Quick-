import { NextResponse } from "next/server";
import { formatPrice, toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import type { OrderEstado, OrderItemEstado } from "@/lib/types";

export const dynamic = "force-dynamic";

const OPEN_ORDER_STATES: OrderEstado[] = [
  "nueva",
  "en_proceso",
  "faltante_reportado",
  "confirmada",
  "despachada",
];

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET() {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      updated_at,
      estado,
      direccion,
      metodo_pago,
      pago_con,
      total_estimado,
      notas,
      chat_id,
      es_prueba,
      chats!orders_chat_id_fkey (
        id,
        phone_number,
        nombre,
        mensaje_pendiente
      ),
      order_items (
        id,
        product_id,
        cantidad,
        precio_unitario,
        estado,
        products!order_items_product_id_fkey ( nombre )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[staff] no se pudieron leer los pedidos", error);
    return NextResponse.json({ error: "No pudimos leer los pedidos" }, { status: 500 });
  }

  const orders = (data ?? []).map((order) => {
    const chat = unwrapOne(
      order.chats as
        | {
            id: string;
            phone_number: string;
            nombre: string | null;
            mensaje_pendiente?: boolean;
          }
        | {
            id: string;
            phone_number: string;
            nombre: string | null;
            mensaje_pendiente?: boolean;
          }[]
        | null
    );
    const items = Array.isArray(order.order_items) ? order.order_items : [];

    return {
      id: order.id as string,
      chatId: (order.chat_id as string | null) || (chat?.id ? String(chat.id) : null),
      createdAt: order.created_at as string,
      updatedAt: order.updated_at as string,
      estado: order.estado as OrderEstado,
      direccion: String(order.direccion ?? ""),
      metodoPago: String(order.metodo_pago ?? ""),
      pagoCon: order.pago_con == null ? null : toMoney(order.pago_con),
      totalEstimado: toMoney(order.total_estimado),
      totalLabel: formatPrice(order.total_estimado),
      notas: order.notas ? String(order.notas) : null,
      clienteNombre: chat?.nombre ? String(chat.nombre) : null,
      clienteTelefono: chat?.phone_number ? String(chat.phone_number) : "Sin teléfono",
      mensajePendiente: Boolean(chat?.mensaje_pendiente),
      esPrueba: Boolean(order.es_prueba),
      items: items.map((item) => {
        const product = unwrapOne(
          item.products as { nombre: string } | { nombre: string }[] | null
        );
        const cantidad = Number(item.cantidad);
        const precio = toMoney(item.precio_unitario);
        return {
          id: item.id as string,
          productId: item.product_id as string,
          nombre: product?.nombre ? String(product.nombre) : "Producto",
          cantidad,
          precioUnitario: precio,
          precioLabel: formatPrice(precio * cantidad),
          estado: String(item.estado ?? "ok") as OrderItemEstado,
        };
      }),
    };
  });

  const { data: waitingChats, error: waitingError } = await supabase
    .from("chats")
    .select("id, phone_number, nombre, esperando_humano_desde")
    .eq("esperando_humano", true)
    .order("esperando_humano_desde", { ascending: true });

  if (waitingError) {
    console.error("[staff] no se pudieron leer chats en espera", waitingError);
  }

  const openOrderChatIds = new Set(
    orders
      .filter((order) => OPEN_ORDER_STATES.includes(order.estado))
      .map((order) => order.chatId)
      .filter((id): id is string => Boolean(id))
  );

  const humanHelp = (waitingChats ?? []).map((chat) => {
    const id = String(chat.id);
    return {
      id,
      phoneNumber: String(chat.phone_number ?? ""),
      nombre: chat.nombre ? String(chat.nombre) : null,
      waitingSince: chat.esperando_humano_desde ? String(chat.esperando_humano_desde) : null,
      hasOpenOrder: openOrderChatIds.has(id),
    };
  });

  return NextResponse.json({ orders, humanHelp });
}
