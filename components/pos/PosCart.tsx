"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { lineSubtotal, saleTotal, type PosSaleItem } from "@/lib/pos-shared";
import { formatPrice } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PosCartProps = {
  lines: PosSaleItem[];
  onChangeQty: (productoId: string, cantidad: number) => void;
  onRemove: (productoId: string) => void;
  onClear: () => void;
  onCharge: () => void;
};

export function PosCart({ lines, onChangeQty, onRemove, onClear, onCharge }: PosCartProps) {
  const total = saleTotal(lines);

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
            {lines.map((line) => (
              <Card key={line.productoId} className="p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{line.nombre}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatPrice(line.precioUnitario)}</p>
                  </div>
                  <p className="shrink-0 text-base font-semibold tabular-nums">
                    {formatPrice(lineSubtotal(line.cantidad, line.precioUnitario))}
                  </p>
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
              </Card>
            ))}
          </ul>
        )}
      </div>
      <div className="shrink-0 space-y-3 border-t border-border p-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(total)}</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="text-4xl font-bold leading-none tabular-nums">{formatPrice(total)}</span>
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
