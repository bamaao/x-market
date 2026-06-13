function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export const COMMON_MATURITY_TIMEZONES = [
  "UTC",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

/** Browser IANA timezone, fallback UTC. */
export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** UTC offset in minutes at `utcDate` (local = UTC + offset). */
export function getTimeZoneOffsetMinutes(timeZone: string, utcDate: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(utcDate);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === "+" ? 1 : -1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? 0);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

export function timezoneLabel(timeZone: string, at: Date = new Date()): string {
  const offsetMin = getTimeZoneOffsetMinutes(timeZone, at);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = Math.floor(abs / 60);
  const om = abs % 60;
  const offset = `UTC${sign}${pad2(oh)}:${pad2(om)}`;
  if (timeZone === "UTC") return `UTC（协调世界时 · ${offset}）`;
  return `${timeZone}（${offset}）`;
}

export function buildTimezoneOptions(preferredTz: string): { value: string; label: string }[] {
  const ordered = [preferredTz, "UTC", ...COMMON_MATURITY_TIMEZONES];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const tz of ordered) {
    if (!tz || seen.has(tz)) continue;
    seen.add(tz);
    values.push(tz);
  }
  return values.map((value) => ({ value, label: timezoneLabel(value) }));
}

/** Format Unix seconds as `datetime-local` wall time in `timeZone`. */
export function formatZonedDatetimeInput(unixSec: number, timeZone: string): string {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(unixSec * 1000));
  return s.replace(" ", "T");
}

/** Parse `YYYY-MM-DDTHH:mm` as wall time in `timeZone` → Unix seconds (UTC). */
export function parseZonedDatetimeInput(value: string, timeZone: string): number {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return NaN;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const hh = Number(match[4]);
  const mm = Number(match[5]);
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return NaN;

  let utcMs = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 3; i++) {
    const offsetMin = getTimeZoneOffsetMinutes(timeZone, new Date(utcMs));
    utcMs = Date.UTC(y, m - 1, d, hh, mm) - offsetMin * 60_000;
  }
  return Math.floor(utcMs / 1000);
}

export function defaultMaturityZonedInput(timeZone: string, offsetDays = 7): string {
  const unixSec = Math.floor((Date.now() + offsetDays * 24 * 3600 * 1000) / 1000);
  return formatZonedDatetimeInput(unixSec, timeZone);
}

export function formatUtcDatetimeInput(unixSec: number): string {
  return formatZonedDatetimeInput(unixSec, "UTC");
}

export function formatUtcDisplay(unixSec: number): string {
  return `${formatUtcDatetimeInput(unixSec)} UTC`;
}

export function formatZonedDisplay(unixSec: number, timeZone: string): string {
  const wall = formatZonedDatetimeInput(unixSec, timeZone);
  return `${wall.replace("T", " ")} · ${timezoneLabel(timeZone, new Date(unixSec * 1000))}`;
}
