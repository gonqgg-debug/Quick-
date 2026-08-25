import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { WhatsAppFloat } from "@/components/landing/WhatsAppFloat";
import {
  CUSTOMER_PROGRESS_STEPS,
  customerProgressIndex,
  formatCustomerOrderDate,
  type CustomerOrder,
} from "@/lib/customer-orders-shared";
import { formatOrderNumber, orderStatusColor, orderStatusLabel } from "@/lib/order-display";
import { brand, whatsappHref } from "@/lib/theme";

type PublicOrderViewProps = {
  order: CustomerOrder;
};

export function PublicOrderView({ order }: PublicOrderViewProps) {
  const progress = customerProgressIndex(order.estado);
  const chatHref = `${whatsappHref()}?text=${encodeURIComponent(
    `Hola, necesito ayuda con mi pedido #${formatOrderNumber(order.id)}`
  )}`;

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center px-4 pb-3 pt-4">
          <Link href="/" className="min-w-0" aria-label="Quick! Mini Market">
            <Logo />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Pedido</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight text-brand-ink">
              #{formatOrderNumber(order.id)}
            </h1>
            <p className="mt-1 text-sm text-brand-muted">{formatCustomerOrderDate(order.createdAt)}</p>
          </div>
          <span
            className="mt-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
            style={{ backgroundColor: orderStatusColor(order.estado) }}
          >
            {orderStatusLabel(order.estado)}
          </span>
        </div>

        <section
          className="mt-5 overflow-hidden rounded-[24px] border bg-white"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="px-4 py-4">
            {order.estado === "cancelada" ? null : <ProgressBar current={progress} />}

            <ul className="mt-4 space-y-1.5">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    {item.cantidad}× {item.nombre}
                  </span>
                  <span className="shrink-0 font-semibold">{item.precioLabel}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-sm">
              <span className="font-bold">Entrega: </span>
              {order.direccion}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-bold">Pago: </span>
              {order.metodoPagoLabel}
            </p>
            <p className="mt-4 flex items-baseline justify-between gap-3 border-t pt-3" style={{ borderColor: "#F3F4F6" }}>
              <span className="font-display text-lg font-bold">Total</span>
              <span className="font-display text-lg font-bold">{order.totalLabel}</span>
            </p>
          </div>
        </section>

        <div className="mt-5 rounded-[24px] px-4 py-4" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="text-sm leading-relaxed text-brand-ink">
            Si necesitas un cambio o tienes una duda, escríbenos por WhatsApp.
          </p>
          <a
            href={chatHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-white"
            style={{ backgroundColor: brand.green }}
          >
            Escribir por WhatsApp
          </a>
        </div>
      </div>

      <WhatsAppFloat />
    </main>
  );
}

function ProgressBar({ current }: { current: number }) {
  return (
    <ol className="flex items-start justify-between gap-1" aria-label="Progreso del pedido">
      {CUSTOMER_PROGRESS_STEPS.map((label, index) => {
        const done = index <= current;
        const active = index === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <span className="flex h-2.5 w-full items-center" aria-hidden>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: done ? brand.green : "#E5E7EB",
                  boxShadow: active ? `0 0 0 3px ${brand.green}33` : undefined,
                }}
              />
              {index < CUSTOMER_PROGRESS_STEPS.length - 1 ? (
                <span
                  className="ml-1 h-0.5 min-w-0 flex-1 rounded-full"
                  style={{ backgroundColor: index < current ? brand.green : "#E5E7EB" }}
                />
              ) : null}
            </span>
            <span
              className="mt-1.5 text-[10px] font-bold leading-tight"
              style={{ color: done ? brand.ink : brand.muted }}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
