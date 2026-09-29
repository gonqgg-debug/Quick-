"use client";

import { useMemo, useState } from "react";
import { categoryEmoji } from "@/lib/theme";
import { foldText, posThumbUrl, productInitials, stockBadge, type PosProduct } from "@/lib/pos-shared";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type PosCatalogProps = {
  products: PosProduct[];
  loading: boolean;
  offlineEmpty: boolean;
  loadError: boolean;
  flashId: string | null;
  onAdd: (product: PosProduct) => void;
};

export function PosCatalog({ products, loading, offlineEmpty, loadError, flashId, onAdd }: PosCatalogProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todos");

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const product of products) {
      if (product.categoria.trim()) {
        names.add(product.categoria);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
  }, [products]);

  const visible = useMemo(() => {
    const needle = foldText(query.trim());
    return products.filter((product) => {
      if (category !== "todos" && product.categoria !== category) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return foldText(`${product.nombre} ${product.categoria}`).includes(needle);
    });
  }, [products, query, category]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-border px-3 py-3 md:px-4">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar producto"
          className="h-12 text-base"
          autoComplete="off"
          enterKeyHint="search"
        />
        <div className="overflow-x-auto pb-1">
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="h-auto w-max min-w-full justify-start gap-1 bg-transparent p-0">
              <TabsTrigger value="todos" className="h-11 px-4 text-base">
                Todos
              </TabsTrigger>
              {categories.map((name) => (
                <TabsTrigger key={name} value={name} className="h-11 px-4 text-base">
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando catálogo…</p>
        ) : offlineEmpty ? (
          <p className="max-w-md text-sm text-muted-foreground">
            Sin conexión y este equipo todavía no tiene el catálogo guardado. Conéctate una vez para cargarlo.
          </p>
        ) : loadError && products.length === 0 ? (
          <p className="max-w-md text-sm text-muted-foreground">
            No pudimos cargar el catálogo. Reintenta cuando haya conexión.
          </p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún producto coincide.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => (
              <ProductTile
                key={product.id}
                product={product}
                flash={flashId === product.id}
                onAdd={() => onAdd(product)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductTile({ product, flash, onAdd }: { product: PosProduct; flash: boolean; onAdd: () => void }) {
  const thumb = posThumbUrl(product.fotoUrl);
  const [src, setSrc] = useState(thumb);
  const badge = stockBadge(product.stock);
  const showImage = Boolean(src);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onAdd}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAdd();
        }
      }}
      className={cn(
        "cursor-pointer overflow-hidden shadow-sm transition active:scale-[0.98]",
        flash && "ring-2 ring-primary"
      )}
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
        {showImage ? (
          <>
            {/* next/image goes through the optimizer and fails offline; a broken photo falls back to initials. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src ?? ""}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => {
                if (src && product.fotoUrl && src !== product.fotoUrl) {
                  setSrc(product.fotoUrl);
                  return;
                }
                setSrc(null);
              }}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <span className="text-2xl" aria-hidden>
              {categoryEmoji(product.categoria)}
            </span>
            <span className="text-lg font-semibold text-foreground">{productInitials(product.nombre)}</span>
          </div>
        )}
        {badge ? (
          <Badge variant={badge.tone} className="absolute left-2 top-2 shadow-none">
            {badge.label}
          </Badge>
        ) : null}
      </div>
      <CardContent className="space-y-1 p-3">
        <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{product.nombre}</p>
        <p className="text-lg font-bold tabular-nums">{formatPrice(product.precio)}</p>
      </CardContent>
    </Card>
  );
}
