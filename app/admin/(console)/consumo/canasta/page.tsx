import { ConsumoCanastaVista } from "@/components/admin/consumo/ConsumoCanastaVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { isDayKey, todayDayKey } from "@/lib/local-day";
import { lunesDe } from "@/lib/pos-domain";
import { cargarCanasta, paramsDe } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Canasta | Consumo",
};

export default async function ConsumoCanastaPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = paramsDe(searchParams);
  const raw = params.get("semana");
  const semana = lunesDe(raw && isDayKey(raw) ? raw : todayDayKey());
  try {
    const data = await cargarCanasta(semana, params.get("cursor"));
    return <ConsumoCanastaVista semana={data.semana} rows={data.rows} nextCursor={data.nextCursor} />;
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar la canasta"} />;
  }
}
