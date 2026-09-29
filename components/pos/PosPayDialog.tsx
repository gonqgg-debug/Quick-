"use client";

import { useEffect, useMemo, useState } from "react";
import { cashDelta, quickCashAmounts, saleTotal, type PosMetodoPago, type PosSaleItem } from "@/lib/pos-shared";
import { formatPrice, parsePrice } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const METHODS: Array<{ id: PosMetodoPago; label: string }> = [
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "transferencia", label: "Transferencia" },
];

type PosPayDialogProps = {
  open: boolean;
  lines: PosSaleItem[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (metodo: PosMetodoPago, montoRecibido: number | null) => void;
};

export function PosPayDialog({ open, lines, onOpenChange, onConfirm }: PosPayDialogProps) {
  const [metodo, setMetodo] = useState<PosMetodoPago>("efectivo");
  const [recibido, setRecibido] = useState("");
  const total = saleTotal(lines);
  const amounts = useMemo(() => quickCashAmounts(total), [total]);

  useEffect(() => {
    if (open) {
      setMetodo("efectivo");
      setRecibido("");
    }
  }, [open]);
  const parsed = parsePrice(recibido);
  const delta = metodo === "efectivo" && parsed != null ? cashDelta(parsed, total) : null;
  const canConfirm = metodo !== "efectivo" || (delta != null && delta >= -0.001);

  function confirm() {
    if (!canConfirm) {
      return;
    }
    onConfirm(metodo, metodo === "efectivo" ? parsed : null);
    setRecibido("");
    setMetodo("efectivo");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cobrar</DialogTitle>
          <DialogDescription>Total {formatPrice(total)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {METHODS.map((method) => (
            <Button
              key={method.id}
              type="button"
              variant={metodo === method.id ? "default" : "outline"}
              size="touch"
              className="h-14 text-lg"
              onClick={() => setMetodo(method.id)}
            >
              {method.label}
            </Button>
          ))}
        </div>
        {metodo === "efectivo" ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium" htmlFor="monto-recibido">
              Monto recibido
            </label>
            <Input
              id="monto-recibido"
              inputMode="decimal"
              value={recibido}
              onChange={(event) => setRecibido(event.target.value)}
              className="h-14 text-2xl font-semibold"
              placeholder="0"
            />
            <div className="grid grid-cols-2 gap-2">
              {amounts.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="touch"
                  className="text-base"
                  onClick={() => setRecibido(String(amount))}
                >
                  {amount === Math.ceil(total) ? "Exacto" : formatPrice(amount)}
                </Button>
              ))}
            </div>
            <p
              className={cn(
                "text-center text-3xl font-bold tabular-nums",
                delta != null && delta < -0.001 ? "text-destructive" : "text-foreground"
              )}
            >
              {delta == null
                ? "Cambio —"
                : delta < -0.001
                  ? `Falta ${formatPrice(Math.abs(delta))}`
                  : `Cambio ${formatPrice(delta)}`}
            </p>
          </div>
        ) : (
          <p className="text-center text-3xl font-bold tabular-nums">{formatPrice(total)}</p>
        )}
        <Button type="button" size="touch" className="h-14 w-full text-lg" disabled={!canConfirm} onClick={confirm}>
          Confirmar cobro
        </Button>
      </DialogContent>
    </Dialog>
  );
}
