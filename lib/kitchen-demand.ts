import { localDayEndIso, localDayStartIso, todayDayKey } from "@/lib/local-day";
import { getSupabaseAdminClient } from "@/lib/supabase";

const KITCHEN_STATES = ["nueva", "en_proceso", "faltante_reportado", "confirmada"] as const;

/** Pedidos en cocina hoy (sin pruebas) a partir de los cuales avisamos alta demanda. */
export const HIGH_DEMAND_THRESHOLD = 8;

export const HIGH_DEMAND_MESSAGE =
  "Hay alta demanda ahora. Tu pedido puede tardar más de lo normal.";

export type KitchenDemand = {
  queueSize: number;
  highDemand: boolean;
};

export async function getKitchenDemand(): Promise<KitchenDemand> {
  const supabase = getSupabaseAdminClient();
  const today = todayDayKey();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("estado", [...KITCHEN_STATES])
    .eq("es_prueba", false)
    .gte("created_at", localDayStartIso(today))
    .lte("created_at", localDayEndIso(today));

  if (error) {
    console.error("[demand] no se pudo contar la cola de pedidos", error);
    return { queueSize: 0, highDemand: false };
  }

  const queueSize = count ?? 0;
  return { queueSize, highDemand: queueSize >= HIGH_DEMAND_THRESHOLD };
}
