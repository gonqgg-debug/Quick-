export function formatWaitingSince(iso: string | null, now = Date.now()): string {
  return formatElapsedAgo(iso, now);
}

export function formatElapsedAgo(iso: string | null, now = Date.now()): string {
  if (!iso) {
    return "hace un momento";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "hace un momento";
  }

  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60000));
  if (minutes < 1) {
    return "hace un momento";
  }
  if (minutes < 60) {
    return `hace ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) {
    return rest > 0 ? `hace ${hours}h ${rest}min` : `hace ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
