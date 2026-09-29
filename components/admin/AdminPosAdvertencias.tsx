"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import type { PosAdvertencia } from "@/lib/pos-shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const METODO: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export function AdminPosAdvertencias() {
  const router = useRouter();
  const [rows, setRows] = useState<PosAdvertencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/admin/pos/advertencias", { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as { advertencias?: PosAdvertencia[]; error?: string } | null;
      if (cancelled) {
        return;
      }
      if (!response.ok || !body?.advertencias) {
        setError(body?.error || "No pudimos cargar las advertencias");
        setLoading(false);
        return;
      }
      setRows(body.advertencias);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobro en mostrador</CardTitle>
        <CardDescription>
          Ventas que se registraron igual aunque el stock del servidor no alcanzaba. La venta no se rechaza: el stock puede quedar negativo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay ventas con advertencia de stock.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>{METODO[row.metodoPago] ?? row.metodoPago}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatPrice(row.total)}</TableCell>
                  <TableCell>
                    <Badge variant="warning" className="mb-1">
                      Stock corto
                    </Badge>
                    <p className="text-sm text-muted-foreground">{row.detalle || "El stock quedó por debajo de lo vendido."}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
