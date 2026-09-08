import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function getSalesTotalsByOdooCode(): Promise<Map<string, number>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("sales_history_import").select("codigo_odoo, cantidad_vendida");

  if (error || !data?.length) {
    return new Map();
  }

  const totals = new Map<string, number>();
  for (const row of data) {
    const code = String(row.codigo_odoo ?? "").trim();
    if (!code) {
      continue;
    }
    totals.set(code, (totals.get(code) ?? 0) + toMoney(row.cantidad_vendida));
  }
  return totals;
}
