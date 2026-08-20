import { itemStatusLabel } from "@/lib/order-display";
import { brand } from "@/lib/theme";
import type { OrderItemEstado } from "@/lib/types";

export type OrderSnapshotItem = {
  id: string;
  nombre: string;
  cantidad: number;
  precioLabel: string;
  estado: OrderItemEstado | string;
};

type OrderSnapshotProps = {
  direccion: string;
  metodoPago: string;
  clienteTelefono: string;
  items: OrderSnapshotItem[];
  missingAction?: {
    busyKey: string | null;
    onMissing: (item: OrderSnapshotItem) => void;
  };
};

function paymentLabel(metodo: string): string {
  if (metodo === "efectivo") return "Efectivo";
  if (metodo === "tarjeta") return "Tarjeta";
  return metodo || "—";
}

export function OrderSnapshot({
  direccion,
  metodoPago,
  clienteTelefono,
  items,
  missingAction,
}: OrderSnapshotProps) {
  return (
    <div>
      <div className="space-y-2 rounded-2xl px-4 py-4" style={{ backgroundColor: "#F8FAF7" }}>
        <InfoRow icon={<PinIcon />}>{direccion || "—"}</InfoRow>
        <InfoRow icon={metodoPago === "efectivo" ? <CashIcon /> : <CardIcon />}>
          {paymentLabel(metodoPago)}
        </InfoRow>
        <InfoRow icon={<PhoneIcon />}>{clienteTelefono || "—"}</InfoRow>
      </div>

      <ul className="mt-3 space-y-1">
        {items.length === 0 ? (
          <li className="py-2 text-sm text-brand-muted">Este pedido no tiene ítems.</li>
        ) : (
          items.map((item) => {
            const canMarkMissing = missingAction && item.estado === "ok";
            return (
              <li key={item.id} className="flex items-center gap-2 py-2" style={{ minHeight: 44 }}>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${item.estado === "eliminado" ? "line-through text-brand-muted" : ""}`}
                  >
                    {item.cantidad}× {item.nombre} <ItemPill estado={item.estado} />
                  </p>
                  <p className="text-xs text-brand-muted">{item.precioLabel}</p>
                </div>
                {canMarkMissing ? (
                  <button
                    type="button"
                    disabled={missingAction.busyKey === `missing:${item.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      missingAction.onMissing(item);
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base disabled:opacity-50"
                    style={{ backgroundColor: "#FFF4E5" }}
                    aria-label={`Marcar ${item.nombre} como faltante`}
                  >
                    ⚠️
                  </button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function ItemPill({ estado }: { estado: string }) {
  if (estado === "ok") {
    return (
      <span
        className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold"
        style={{ backgroundColor: "#F3F4F6", color: brand.muted }}
      >
        {itemStatusLabel(estado)}
      </span>
    );
  }
  if (estado === "faltante") {
    return (
      <span
        className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
        style={{ backgroundColor: brand.error }}
      >
        Faltante
      </span>
    );
  }
  return (
    <span
      className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: "#F3F4F6", color: brand.muted }}
    >
      {itemStatusLabel(estado)}
    </span>
  );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0" style={{ color: brand.green }}>
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M7 3h4l1 5-2 1a12 12 0 0 0 5 5l1-2 5 1v4a2 2 0 0 1-2 2A16 16 0 0 1 5 7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
