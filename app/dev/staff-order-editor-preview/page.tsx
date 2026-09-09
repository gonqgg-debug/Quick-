"use client";

import { useEffect, useRef, useState } from "react";
import { StaffOrderEditor } from "@/components/staff/StaffOrderEditor";
import type { Product } from "@/lib/types";

const CATALOG: Product[] = [
  {
    id: "p-coca",
    nombre: "Coca Cola 500 ml",
    marca: "Coca-Cola",
    descripcion: "Botella",
    precio: 50,
    foto_url: null,
    categoria: "Bebidas",
  },
  {
    id: "p-baygon",
    nombre: "Baygon Verde 400 ml",
    marca: "Baygon",
    descripcion: "Insecticida",
    precio: 375,
    foto_url: null,
    categoria: "Hogar",
  },
  {
    id: "p-cheetos",
    nombre: "Cheetos Puffs Jumbo",
    marca: "Cheetos",
    descripcion: "Bolsa",
    precio: 95,
    foto_url: null,
    categoria: "Snacks y dulces",
  },
];

export default function StaffOrderEditorPreviewPage() {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [fetchCount, setFetchCount] = useState(0);
  const [lastQuery, setLastQuery] = useState("ninguna");
  const fetchCountRef = useRef(0);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.includes("/api/staff/products")) {
        const query = new URL(url, window.location.origin).searchParams.get("q") ?? "";
        fetchCountRef.current += 1;
        setFetchCount(fetchCountRef.current);
        setLastQuery(query === "" ? "(vacío)" : query);
        const needle = query.trim().toLowerCase();
        const products = CATALOG.filter(
          (product) =>
            product.nombre.toLowerCase().includes(needle) ||
            (product.marca ?? "").toLowerCase().includes(needle)
        );
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        return new Response(JSON.stringify({ products }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    };
    setReady(true);
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed left-3 right-3 top-3 z-50 rounded-2xl px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: "#1A1A1A" }}>
        Reloj {tick}s · Búsquedas {fetchCount} · última: {lastQuery}
      </div>
      <StaffOrderEditor
        orderId="preview-order"
        orderNumber="E477AA5C"
        items={[
          {
            productId: "p-cheetos",
            nombre: "Cheetos Puffs Jumbo",
            cantidad: 1,
            precioUnitario: 95,
            estado: "ok",
          },
          {
            productId: "p-aviva",
            nombre: "Aviva Integral",
            cantidad: 2,
            precioUnitario: 140,
            estado: "ok",
          },
          {
            productId: "p-coca",
            nombre: "Coca Cola 500 ml",
            cantidad: 1,
            precioUnitario: 50,
            estado: "ok",
          },
        ]}
        onClose={() => undefined}
        onSaved={() => undefined}
        onUnauthorized={() => undefined}
      />
    </div>
  );
}
