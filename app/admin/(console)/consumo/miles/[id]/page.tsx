import { notFound } from "next/navigation";
import { MilesFicha } from "@/components/admin/consumo/MilesFicha";
import { leerHallazgo } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export default async function MilesHallazgoPage({ params }: { params: { id: string } }) {
  let detalle: Awaited<ReturnType<typeof leerHallazgo>> = null;
  try {
    detalle = await leerHallazgo(params.id);
  } catch {
    detalle = null;
  }
  if (!detalle) notFound();
  return (
    <article className="mx-auto max-w-3xl">
      <MilesFicha
        row={detalle.hallazgo}
        eventos={detalle.eventos}
        comentarios={detalle.comentarios}
        investigaciones={detalle.investigaciones}
      />
    </article>
  );
}
