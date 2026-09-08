"use client";

import { brand, categoryEmoji, isPharmaCategory } from "@/lib/theme";
import type { CatalogCategoryChip } from "@/lib/catalog-products-shared";

type CatalogCategoryGridProps = {
  categories: CatalogCategoryChip[];
  onSelect: (categoria: string) => void;
};

export function CatalogCategoryGrid({ categories, onSelect }: CatalogCategoryGridProps) {
  if (categories.length === 0) {
    return null;
  }

  const regular = categories.filter((chip) => !isPharmaCategory(chip.name));
  const pharma = categories.filter((chip) => isPharmaCategory(chip.name));

  return (
    <section className="mt-6">
      <h2 className="font-display text-2xl font-bold text-brand-ink">Categorías</h2>
      <p className="mt-0.5 text-sm text-brand-muted">Entrá a un pasillo y armá el pedido más rápido</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {regular.map((chip) => (
          <CategoryTile
            key={chip.name}
            name={chip.name}
            count={chip.count}
            onSelect={() => onSelect(chip.name)}
          />
        ))}
        {pharma.map((chip) => (
          <CategoryTile
            key={chip.name}
            name={chip.name}
            count={chip.count}
            featured
            onSelect={() => onSelect(chip.name)}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryTile({
  name,
  count,
  featured = false,
  onSelect,
}: {
  name: string;
  count: number;
  featured?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[5.5rem] items-center gap-3 rounded-[22px] border px-3.5 py-3 text-left"
      style={{
        borderColor: featured ? `${brand.blue}40` : "rgba(26,26,26,0.06)",
        backgroundColor: featured ? "#EAF4FB" : "#FFFFFF",
      }}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{ backgroundColor: featured ? "#FFFFFF" : `${brand.green}18` }}
        aria-hidden="true"
      >
        {categoryEmoji(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold leading-tight text-brand-ink">{name}</span>
        <span className="mt-0.5 block text-xs font-semibold" style={{ color: featured ? brand.blue : brand.muted }}>
          {featured ? "PharmaQuick!" : `${count} productos`}
        </span>
      </span>
    </button>
  );
}
