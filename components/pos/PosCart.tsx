"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/money";
import { centsToMoney, lineListCents, lineManualDiscountCents, type CartLine } from "@/lib/pos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PosCartProps = {
  lines: CartLine[];
  subtotal: number;
  descuento: number;
  coinsMoney: number;
  total: number;
  coinsLabel: string | null;
  onChangeQty: (productoId: string, cantidad: number) => void;
  onRemove: (productoId: string) => void;
  onClear: () => void;
  onCharge: () => void;
  onDiscountLine: (productoId: string) => void;
  onDiscountTicket: () => void;
  onQuickcoins: () => void;
};

export function PosCart({
  lines,
  subtotal,
  descuento,
  coinsMoney,
  total,
  coinsLabel,
  onChangeQty,
  onRemove,
  onClear,
  onCharge,
  onDiscountLine,
  onDiscountTicket,
  onQuickcoins,
}: PosCartProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">Carrito</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {lines.length === 0 ? (
          <p className="px-1 py-6 text-sm text-muted-foreground">Toca un producto para agregarlo.</p>
        ) : (
          <ul className="space-y-3">
            {lines.map((line) => {
              const discount = centsToMoney(lineManualDiscountCents(line));
              const net = centsToMoney(lineListCents(line) - lineManualDiscountCents(line));
              return (
                <Card key={line.productoId} className="p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{line.nombre}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatPrice(line.precioUnitario)}</p>
                      {discount > 0 ? <p className="text-sm text-primary">Descuento −{formatPrice(discount)}</p> : null}
                    </div>
                    <p className="shrink-0 text-base font-semibold tabular-nums">{formatPrice(net)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="touch"
                      className="w-12 text-xl"
                      onClick={() => onChangeQty(line.productoId, line.cantidad - 1)}
                      aria-label={`Quitar uno de ${line.nombre}`}
                    >
                      −
                    </Button>
                    <QtyField
                      value={line.cantidad}
                      label={`Cantidad de ${line.nombre}`}
                      onCommit={(cantidad) => onChangeQty(line.productoId, cantidad)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="touch"
                      className="w-12 text-xl"
                      onClick={() => onChangeQty(line.productoId, line.cantidad + 1)}
                      aria-label={`Agregar uno de ${line.nombre}`}
                    >
                      +
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="touch"
                      className="ml-auto w-12"
                      onClick={() => onRemove(line.productoId)}
                      aria-label={`Quitar ${line.nombre}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Button type="button" variant="ghost" className="mt-1 h-10 px-2" onClick={() => onDiscountLine(line.productoId)}>
                    Descuento de línea
                  </Button>
                </Card>
              );
            })}
          </ul>
        )}
      </div>
      <div className="shrink-0 space-y-3 border-t border-border p-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        {descuento > 0 ? (
          <div className="flex items-center justify-between text-sm text-primary">
            <span>Descuento</span>
            <span className="tabular-nums">−{formatPrice(descuento)}</span>
          </div>
        ) : null}
        {coinsMoney > 0 ? (
          <div className="flex items-center justify-between text-sm text-warning">
            <span>QuickCoins</span>
            <span className="tabular-nums">−{formatPrice(coinsMoney)}</span>
          </div>
        ) : null}
        <div className="flex items-end justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="text-4xl font-bold leading-none tabular-nums">{formatPrice(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="touch" disabled={lines.length === 0} onClick={onDiscountTicket}>
            Descuento
          </Button>
          <Button type="button" variant="outline" size="touch" disabled={lines.length === 0} onClick={onQuickcoins}>
            {coinsLabel ?? "QuickCoins"}
          </Button>
        </div>
        <Button type="button" size="touch" className="h-14 w-full text-lg" disabled={lines.length === 0} onClick={onCharge}>
          Cobrar
        </Button>
        <Button type="button" variant="outline" size="touch" className="w-full" disabled={lines.length === 0} onClick={onClear}>
          Vaciar carrito
        </Button>
      </div>
    </div>
  );
}

function QtyField({ value, label, onCommit }: { value: number; label: string; onCommit: (cantidad: number) => void }) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit(next: string) {
    if (!next) {
      onCommit(0);
      return;
    }
    onCommit(Number(next));
  }

  return (
    <Input
      inputMode="numeric"
      value={text}
      aria-label={label}
      className="h-12 w-16 text-center text-lg font-semibold"
      onChange={(event) => setText(event.target.value.replace(/\D/g, "").slice(0, 3))}
      onBlur={() => commit(text)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}
