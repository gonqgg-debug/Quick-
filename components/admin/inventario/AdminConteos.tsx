"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminInput } from "@/components/admin/shell/AdminField";
import { brand } from "@/lib/theme";

type ConteoHecho = { productoId: string; stockDespues: number; cuando: string };

export function AdminConteos() {
  const router = useRouter();
  const [tienda, setTienda] = useState("quick");
  const [productoId, setProductoId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hechos, setHechos] = useState<ConteoHecho[]>([]);

  async function guardar() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/inventario/conteos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tienda,
          productoId: productoId.trim() || undefined,
          codigoOdoo: codigo.trim() || undefined,
          cantidadContada: Number(cantidad),
          nota,
        }),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json()) as { conteo?: { productoId: string; stockDespues: number }; error?: string };
      if (!response.ok || !body.conteo) {
        throw new Error(body.error || "No pudimos guardar el conteo");
      }
      setHechos((current) => [{ productoId: body.conteo!.productoId, stockDespues: body.conteo!.stockDespues, cuando: new Date().toLocaleTimeString("es-DO") }, ...current]);
      setCantidad("");
      setNota("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No pudimos guardar el conteo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Inventario</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Conteos</h1>
      <p className="mt-2 text-sm text-brand-muted">La cantidad contada deja el stock en ese número. El costo promedio no cambia.</p>
      <div className="mt-5 space-y-3">
        <AdminInput value={tienda} onChange={(event) => setTienda(event.target.value)} aria-label="Tienda" />
        <AdminInput value={productoId} onChange={(event) => setProductoId(event.target.value)} placeholder="Id del producto" aria-label="Producto" />
        <AdminInput value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="O código Odoo" aria-label="Código" />
        <AdminInput value={cantidad} onChange={(event) => setCantidad(event.target.value)} inputMode="decimal" placeholder="Cantidad contada" aria-label="Cantidad contada" />
        <AdminInput value={nota} onChange={(event) => setNota(event.target.value)} placeholder="Nota" aria-label="Nota" />
        <button type="button" disabled={busy} onClick={() => void guardar()} className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-50" style={{ minHeight: 44, backgroundColor: brand.navy }}>
          {busy ? "Guardando…" : "Guardar conteo"}
        </button>
      </div>
      {error ? <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>{error}</p> : null}
      {hechos.length ? (
        <ul className="mt-6 space-y-2">
          {hechos.map((hecho) => (
            <li key={`${hecho.productoId}-${hecho.cuando}`} className="rounded-2xl border border-[#E7EBE4] px-4 py-3 text-sm">
              <span className="font-semibold">{hecho.cuando}</span>
              <span className="text-brand-muted"> · stock {hecho.stockDespues}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
