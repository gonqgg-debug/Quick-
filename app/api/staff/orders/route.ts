import { NextResponse } from "next/server";
import { formatPrice, toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import type { OrderEstado, OrderItemEstado } from "@/lib/types";

export const dynamic = "force-dynamic";

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
      total_estimado,
      notas,
      chats (
        phone_number,
        nombre
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
        | { phone_number: string; nombre: string | null }
        | { phone_number: string; nombre: string | null }[]
        | null
    );
    const items = Array.isArray(order.order_items) ? order.order_items : [];

    return {
      id: order.id as string,
      createdAt: order.created_at as string,
      updatedAt: order.updated_at as string,
      estado: order.estado as OrderEstado,
      direccion: String(order.direccion ?? ""),
      metodoPago: String(order.metodo_pago ?? ""),
      totalEstimado: toMoney(order.total_estimado),
      totalLabel: formatPrice(order.total_estimado),
      notas: order.notas ? String(order.notas) : null,
      clienteNombre: chat?.nombre ? String(chat.nombre) : null,
      clienteTelefono: chat?.phone_number ? String(chat.phone_number) : "Sin teléfono",
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

  return NextResponse.json({ orders });
}
