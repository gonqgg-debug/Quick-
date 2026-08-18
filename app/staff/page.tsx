import { Badge } from "@/components/brand/Badge";
import { Logo } from "@/components/brand/Logo";

export default function StaffPage() {
  return (
    <main className="min-h-screen bg-brand-white px-6 py-10 text-brand-ink">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <Logo />
            <h1 className="font-display mt-4 text-3xl font-bold">Pedidos en curso</h1>
          </div>
          <Badge variant="green">Personal</Badge>
        </header>
        <section className="rounded-3xl border border-dashed border-brand-muted/30 bg-brand-white p-10 text-center text-brand-muted">
          La lista de pedidos se implementará aquí.
        </section>
      </div>
    </main>
  );
}
