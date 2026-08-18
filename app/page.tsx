import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Quick Orders
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Pedidos por WhatsApp</h1>
        <p className="mt-3 text-zinc-600">
          Esqueleto de la aplicación. Las pantallas y APIs están listas para implementar
          la lógica de negocio.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/staff"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Panel de personal
          </Link>
          <Link
            href="/order/demo"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Catálogo de ejemplo
          </Link>
        </div>
      </div>
    </main>
  );
}
