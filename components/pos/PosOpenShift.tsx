"use client";

import { useState } from "react";
import { defaultTurnoPeriodo, type CajaTurnoPeriodo } from "@/lib/admin-caja-shared";
import { STAFF_TIMEZONE } from "@/lib/local-day";
import { formatPrice, parsePrice } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const FONDOS = [0, 1000, 2000, 5000];

type PosOpenShiftProps = {
  onOpen: (periodo: CajaTurnoPeriodo, fondoInicial: number) => void;
};

export function PosOpenShift({ onOpen }: PosOpenShiftProps) {
  const [periodo, setPeriodo] = useState<CajaTurnoPeriodo>(defaultTurnoPeriodo());
  const [fondo, setFondo] = useState("0");
  const parsed = parsePrice(fondo);
  const fondoInicial = parsed == null || parsed < 0 ? null : parsed;
  const today = new Date().toLocaleDateString("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: STAFF_TIMEZONE,
  });

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-4 py-8">
      <Card className="w-full max-w-lg shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div>
            <h2 className="text-2xl font-semibold">Abrir turno</h2>
            <p className="mt-1 text-sm capitalize text-muted-foreground">{today}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["AM", "PM"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="touch"
                variant={periodo === value ? "default" : "outline"}
                className="h-16 text-2xl"
                onClick={() => setPeriodo(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="fondo-inicial">
              Fondo inicial en caja
            </label>
            <Input
              id="fondo-inicial"
              inputMode="decimal"
              value={fondo}
              onChange={(event) => setFondo(event.target.value)}
              className="h-14 text-2xl font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              {FONDOS.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="touch"
                  onClick={() => setFondo(String(amount))}
                >
                  {amount === 0 ? "Sin fondo" : formatPrice(amount)}
                </Button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            size="touch"
            className="h-14 w-full text-lg"
            disabled={fondoInicial == null}
            onClick={() => onOpen(periodo, fondoInicial ?? 0)}
          >
            Abrir turno {periodo}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
