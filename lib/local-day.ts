export const STAFF_TIMEZONE = "America/Santo_Domingo";

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

export function todayDayKey(now = Date.now(), timeZone = STAFF_TIMEZONE): string {
  return dayKey(new Date(now), timeZone);
}

export function isToday(iso: string, now = Date.now()): boolean {
  return localDayKey(iso) === dayKey(new Date(now));
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_KEY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

export function isDayKey(value: string): boolean {
  return DAY_KEY.test(value);
}

/** Calendar `YYYY-MM-DD` as stored, without converting through a timezone (avoids shifting the day). */
export function calendarDayKey(value: unknown): string {
  if (typeof value === "string") {
    const match = DAY_KEY_PREFIX.exec(value.trim());
    if (!match) {
      return "";
    }
    const key = `${match[1]}-${match[2]}-${match[3]}`;
    return isDayKey(key) ? key : "";
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const key = `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
    return isDayKey(key) ? key : "";
  }
  return "";
}

/** ISO weekday: 1 = Monday … 7 = Sunday. Derived from the calendar date, never from `dia_semana` text. */
export function isoWeekdayMonday1(fecha: unknown): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
  const key = calendarDayKey(fecha);
  const match = DAY_KEY.exec(key);
  if (!match) {
    return null;
  }
  const utcDay = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return (utcDay === 0 ? 7 : utcDay) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function addDaysToDayKey(value: string, days: number): string {
  const match = DAY_KEY.exec(value);
  if (!match) {
    return value;
  }
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return new Date(utc).toISOString().slice(0, 10);
}

/** Last calendar day that already ended in the staff timezone (never “today”). */
export function yesterdayDayKey(now = Date.now(), timeZone = STAFF_TIMEZONE): string {
  return addDaysToDayKey(todayDayKey(now, timeZone), -1);
}

export function diffDayKeys(from: string, to: string): number {
  const start = DAY_KEY.exec(from);
  const end = DAY_KEY.exec(to);
  if (!start || !end) {
    return 0;
  }
  const fromUtc = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const toUtc = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function formatDayKey(value: string): string {
  const match = DAY_KEY.exec(value);
  if (!match) {
    return value;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function partsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function wallTimeToUtcIso(
  dayKeyValue: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone = STAFF_TIMEZONE
): string {
  const match = DAY_KEY.exec(dayKeyValue);
  if (!match) {
    return new Date(0).toISOString();
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  for (let step = 0; step < 4; step += 1) {
    const local = partsInTimeZone(new Date(utcMs), timeZone);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, millisecond);
    const desired = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
    const delta = desired - localAsUtc;
    if (delta === 0) {
      break;
    }
    utcMs += delta;
  }
  return new Date(utcMs).toISOString();
}

export function localDayStartIso(dayKeyValue: string, timeZone = STAFF_TIMEZONE): string {
  return wallTimeToUtcIso(dayKeyValue, 0, 0, 0, 0, timeZone);
}

export function localDayEndIso(dayKeyValue: string, timeZone = STAFF_TIMEZONE): string {
  return wallTimeToUtcIso(dayKeyValue, 23, 59, 59, 999, timeZone);
}
