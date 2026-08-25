"use client";

import Image from "next/image";
import { brand } from "@/lib/theme";
import type { Product } from "@/lib/types";

function canOptimizeImage(src: string): boolean {
  if (src.startsWith("/")) {
    return true;
  }
  try {
    const url = new URL(src, "https://quick.local");
    if (url.hostname.endsWith(".supabase.co")) {
      return true;
    }
    if (url.hostname.endsWith(".openfoodfacts.org")) {
      return true;
    }
    return url.hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

export function CatalogProductPhoto({
  product,
  className,
  sizes,
  roundedClassName = "rounded-2xl",
}: {
  product: Product;
  className: string;
  sizes: string;
  roundedClassName?: string;
}) {
  if (!product.foto_url) {
    return (
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center font-display font-bold ${roundedClassName} ${className}`}
        style={{ backgroundColor: `${brand.green}18`, color: brand.green }}
      >
        {product.nombre.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <span className={`relative block shrink-0 overflow-hidden ${roundedClassName} ${className}`}>
      <Image
        src={product.foto_url}
        alt={product.nombre}
        fill
        sizes={sizes}
        loading="lazy"
        className="object-cover"
        unoptimized={!canOptimizeImage(product.foto_url)}
      />
    </span>
  );
}
