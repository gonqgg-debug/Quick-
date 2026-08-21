import { publicOrderUrl } from "@/lib/app-url";
import { getSupabaseAdminClient } from "@/lib/supabase";

const TEST_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export type TestOrderSession = {
  sessionId: string;
  url: string;
  expiraEn: string;
};

export async function createTestOrderSession(): Promise<TestOrderSession> {
  const supabase = getSupabaseAdminClient();
  const stamp = Date.now();

  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .insert({
      phone_number: `prueba-${stamp}`,
      nombre: "Pedido de prueba",
    })
    .select("id")
    .single();

  if (chatError || !chat) {
    throw new Error("No pudimos crear el chat de prueba");
  }

  const expiraEn = new Date(Date.now() + TEST_SESSION_TTL_MS).toISOString();
  const { data: session, error: sessionError } = await supabase
    .from("order_sessions")
    .insert({
      chat_id: chat.id,
      estado: "activa",
      es_prueba: true,
      expira_en: expiraEn,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error("No pudimos crear la sesión de prueba");
  }

  return {
    sessionId: session.id as string,
    url: publicOrderUrl(session.id as string),
    expiraEn,
  };
}
