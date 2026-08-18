export default function StaffPage() {
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Panel de personal
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Pedidos en curso</h1>
        </header>
        <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
          La lista de pedidos se implementará aquí.
        </section>
      </div>
    </main>
  );
}
