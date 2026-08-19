import { NextResponse } from "next/server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id, phone_number, nombre, esperando_humano, esperando_humano_desde")
    .eq("esperando_humano", true)
    .order("esperando_humano_desde", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[staff] no se pudieron leer los chats en espera", error);
    return NextResponse.json({ error: "No pudimos leer los chats" }, { status: 500 });
  }

  const chats = (data ?? []).map((chat) => ({
    id: chat.id as string,
    phoneNumber: String(chat.phone_number ?? ""),
    nombre: chat.nombre ? String(chat.nombre) : null,
    esperandoHumano: Boolean(chat.esperando_humano),
    esperandoHumanoDesde: chat.esperando_humano_desde
      ? String(chat.esperando_humano_desde)
      : null,
  }));

  return NextResponse.json({ chats });
}
