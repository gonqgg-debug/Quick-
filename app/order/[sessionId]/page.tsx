type OrderCatalogPageProps = {
  params: {
    sessionId: string;
  };
};

export default function OrderCatalogPage({ params }: OrderCatalogPageProps) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Catálogo del cliente
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Quick Orders</h1>
        <p className="mt-2 text-zinc-600">
          Sesión: <span className="font-mono text-zinc-900">{params.sessionId}</span>
        </p>
        <section className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          El catálogo se implementará aquí.
        </section>
      </div>
    </main>
  );
}
