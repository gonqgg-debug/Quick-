const STAFF_TIMEZONE = "America/Santo_Domingo";

function dayKey(date: Date, timeZone = STAFF_TIMEZONE): string {
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function localDayKey(iso: string, timeZone = STAFF_TIMEZONE): string {
  return dayKey(new Date(iso), timeZone);
}

export function isToday(iso: string, now = Date.now()): boolean {
  return localDayKey(iso) === dayKey(new Date(now));
}
