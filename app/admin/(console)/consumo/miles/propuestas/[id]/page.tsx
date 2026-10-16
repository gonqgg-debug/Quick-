import { ComboFicha } from "@/components/admin/consumo/ComboFicha";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { leerPropuesta } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Propuesta | Miles" };

export default async function PropuestaPage({ params }: { params: { id: string } }) {
  try {
    const propuesta = await leerPropuesta(params.id);
    if (!propuesta) return <ErrorPanel message="No está esa propuesta" />;
    return (
      <article className="mx-auto max-w-3xl">
        <ComboFicha propuesta={propuesta} />
      </article>
    );
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar la propuesta"} />;
  }
}
