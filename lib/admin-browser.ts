import { createBrowserClient } from "@supabase/ssr";

export function createAdminBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan las variables de Supabase");
  }
  return createBrowserClient(url, anonKey);
}
