#!/usr/bin/env bash
# Aplica las migraciones de caja e inventario contra la base indicada en SUPABASE_DB_URL.
# Usa la conexión directa de Supabase (puerto 5432), no el pooler.
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Falta SUPABASE_DB_URL. Es la URI directa de Database → Connection string en Supabase." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Falta psql." >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
files=(
  supabase/migrations/20260929120000_ventas_pos.sql
  supabase/migrations/20260929140000_pos_turnos.sql
  supabase/migrations/20260929140000_inventario.sql
  supabase/migrations/20260929160000_pos_descuentos_quickcoins.sql
  supabase/migrations/20260930120000_pos_usa_inventario.sql
)

for file in "${files[@]}"; do
  echo "Aplicando ${file}"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$root/$file"
done

echo "Listo."
