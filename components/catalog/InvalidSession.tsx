import { Logo } from "@/components/brand/Logo";

type InvalidSessionProps = {
  title?: string;
  message?: string;
};

export function InvalidSession({
  title = "Este enlace ya no está disponible",
  message = "Solicita un enlace nuevo por WhatsApp para armar tu pedido.",
}: InvalidSessionProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-white px-5 py-16">
      <section className="w-full max-w-md rounded-[28px] border border-brand-muted/20 bg-brand-white px-6 py-10 text-center">
        <Logo />
        <h1 className="font-display mt-5 text-3xl font-bold leading-tight text-brand-ink">
          {title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-brand-muted">{message}</p>
        <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-brand-green px-4 py-2 text-sm font-bold text-brand-green">
          Escríbenos por WhatsApp
        </p>
      </section>
    </main>
  );
}
