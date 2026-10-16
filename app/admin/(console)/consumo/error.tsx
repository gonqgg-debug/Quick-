"use client";

import { brand } from "@/lib/theme";

export default function ConsumoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
      <p>No pudimos cargar el consumo</p>
      {error.digest ? <p className="mt-1 font-mono text-xs">{error.digest}</p> : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Reintentar
      </button>
    </div>
  );
}
