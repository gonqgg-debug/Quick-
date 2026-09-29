import Link from "next/link";

export const metadata = {
  title: "Sin conexión",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="text-muted-foreground">
        Esta pantalla no está guardada en el equipo. Abre Cobro una vez con internet para dejar el catálogo listo.
      </p>
      <Link href="/pos" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground">
        Ir a Cobro
      </Link>
    </main>
  );
}
