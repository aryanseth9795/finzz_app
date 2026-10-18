/**
 * Pure calendar helpers for the charts. UTC-based so the device timezone can
 * never shift a day across a month boundary.
 */

export const WEEKDAY_SHORT_MON_FIRST = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

/** Number of days in `month` (1-12) of `year`. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Weeks x 7 grid for a month, Monday-first. Cells outside the month are null.
 * `month` is 1-12.
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const total = daysInMonth(year, month);
  // getUTCDay: 0=Sun..6=Sat -> Monday-first offset 0..6
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Heat bucket 0..4. 0 only when value is 0 (or unusable); any positive value
 * is at least 1, using ceil-based quarters of `max`.
 */
export function heatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isFinite(value) || !Number.isFinite(max)) return 0;
  if (value <= 0 || max <= 0) return 0;
  const lvl = Math.ceil((value / max) * 4);
  return Math.min(4, Math.max(1, lvl)) as 1 | 2 | 3 | 4;
}

/** Compact number for chart labels: 950 -> "950", 1200 -> "1.2k", 2500000 -> "2.5M". */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const trim = (v: number) => String(Math.round(v * 10) / 10);
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}
