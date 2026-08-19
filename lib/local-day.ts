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

export function isToday(iso: string, now = Date.now()): boolean {
  return localDayKey(iso) === dayKey(new Date(now));
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(value: string): boolean {
  return DAY_KEY.test(value);
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
