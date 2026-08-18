import { getSupabaseAdminClient } from "@/lib/supabase";
import { toMoney } from "@/lib/money";
import type { OrderSession, Product } from "@/lib/types";

export async function getActiveOrderSession(
  sessionId: string
): Promise<OrderSession | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_sessions")
    .select("id, chat_id, estado, expira_en")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const session = data as OrderSession;
  if (session.estado !== "activa") {
    return null;
  }

  if (new Date(session.expira_en).getTime() <= Date.now()) {
    return null;
  }

  return session;
}

export async function getActiveProducts(): Promise<Product[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, nombre, marca, descripcion, precio, foto_url, categoria")
    .eq("activo", true)
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    marca: (row.marca as string | null) ?? null,
    descripcion: (row.descripcion as string | null) ?? null,
    precio: toMoney(row.precio),
    foto_url: (row.foto_url as string | null) ?? null,
    categoria: row.categoria as string,
  }));
}
