"use client";

import { useState } from "react";
import { parsePrice } from "@/lib/money";
import { POS_DESCUENTO_TOPE_PCT, type PosDescuento } from "@/lib/pos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const PERCENTS = [5, 10, 15, POS_DESCUENTO_TOPE_PCT];

export function PosDiscount({
  open,
  title,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onApply: (descuento: PosDescuento) => void;
}) {
  const [montoRaw, setMontoRaw] = useState("");
  const monto = parsePrice(montoRaw);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="font-display">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Hasta {POS_DESCUENTO_TOPE_PCT}% entre la línea y el ticket.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          {PERCENTS.map((percent) => (
            <Button key={percent} type="button" size="touch" onClick={() => onApply({ tipo: "porcentaje", valor: percent })}>
              {percent}%
            </Button>
          ))}
        </div>
        <label className="text-sm font-medium" htmlFor="pos-descuento-monto">
          Monto fijo
        </label>
        <Input
          id="pos-descuento-monto"
          inputMode="decimal"
          value={montoRaw}
          onChange={(event) => setMontoRaw(event.target.value)}
          className="h-14 text-2xl font-semibold"
        />
        <Button
          type="button"
          size="touch"
          className="h-14 w-full text-lg"
          disabled={monto == null || monto <= 0}
          onClick={() => {
            if (monto != null) onApply({ tipo: "monto", valor: monto });
          }}
        >
          Aplicar monto
        </Button>
        <Button type="button" variant="outline" size="touch" onClick={() => onApply({ tipo: "ninguno" })}>
          Quitar descuento
        </Button>
      </DialogContent>
    </Dialog>
  );
}
