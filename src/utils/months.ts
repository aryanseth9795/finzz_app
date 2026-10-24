import type { IAvailableMonth } from "../types";
import { toApiDate } from "./dates";

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

export const MONTH_SHORT: readonly string[] = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MONTH_LONG: readonly string[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ordinal = (ym: YearMonth): number => ym.year * 12 + ym.month;

export const monthKey = (ym: YearMonth): string =>
  `${ym.year}-${String(ym.month).padStart(2, "0")}`;

export const monthLabel = (
  ym: YearMonth,
  style: "long" | "short" = "long",
): string =>
  `${(style === "long" ? MONTH_LONG : MONTH_SHORT)[ym.month - 1]} ${ym.year}`;

export const isSameMonth = (a: YearMonth, b: YearMonth): boolean =>
  a.year === b.year && a.month === b.month;

/** True only when `stats` (as echoed by the server) belong to month `ym`. */
export const isStatsForMonth = (
  stats: YearMonth | null | undefined,
  ym: YearMonth,
): boolean => !!stats && isSameMonth(stats, ym);

export const currentYearMonth = (now: Date): YearMonth => ({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
});

/** `ym` moved by `delta` months (negative = earlier), across year boundaries. */
export const addMonths = (ym: YearMonth, delta: number): YearMonth => {
  const idx = ym.year * 12 + (ym.month - 1) + Math.trunc(delta);
  return { year: Math.floor(idx / 12), month: (((idx % 12) + 12) % 12) + 1 };
};

/** The `count` months ending at (and including) `end`, newest first. */
export const monthsEndingAt = (end: YearMonth, count: number): YearMonth[] =>
  Array.from(
    { length: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0 },
    (_, i) => addMonths(end, -i),
  );

/**
 * Per-month counts (keyed by monthKey) after a reply that covers the `span`
 * months ending at `end`. A month with no rows is absent from such a reply, so
 * every month in the window is first reset to 0, then `fresh` is applied.
 * Months outside the window keep their previous counts.
 */
export const mergeWindowCounts = (
  prev: Record<string, number>,
  end: YearMonth,
  span: number,
  fresh: Record<string, number>,
): Record<string, number> => {
  const out: Record<string, number> = { ...prev };
  for (const ym of monthsEndingAt(end, span)) out[monthKey(ym)] = 0;
  return Object.assign(out, fresh);
};

export const sortMonthsDesc = <T extends YearMonth>(months: T[]): T[] =>
  [...months].sort((a, b) => ordinal(b) - ordinal(a));

export const withCurrentMonth = (
  months: IAvailableMonth[],
  now: Date,
): IAvailableMonth[] => {
  const current = currentYearMonth(now);
  const has = months.some((m) => isSameMonth(m, current));
  return sortMonthsDesc(has ? months : [...months, { ...current, txCount: 0 }]);
};

/** -1 = previous (older) available month, +1 = next (newer); null at the ends. */
export const stepMonth = (
  months: IAvailableMonth[],
  selected: YearMonth,
  dir: -1 | 1,
): IAvailableMonth | null => {
  const at = ordinal(selected);
  const candidates = months.filter((m) =>
    dir === -1 ? ordinal(m) < at : ordinal(m) > at,
  );
  if (candidates.length === 0) return null;
  const sorted = sortMonthsDesc(candidates);
  return dir === -1 ? sorted[0] : sorted[sorted.length - 1];
};

export interface MonthCell {
  month: number;
  count: number;
  enabled: boolean;
  isCurrent: boolean;
}

export interface YearGridOptions {
  /**
   * Enable every month listed in `months`, even one with a zero count, for
   * callers whose counts are partial (they then only drive the badges).
   * Default false: a month is enabled only when it has transactions or is the
   * current month. Unlisted months stay disabled either way (except current).
   */
  enableAllMonths?: boolean;
}

export const yearGrid = (
  months: IAvailableMonth[],
  now: Date,
  { enableAllMonths = false }: YearGridOptions = {},
): { year: number; cells: MonthCell[] }[] => {
  const current = currentYearMonth(now);
  const counts = new Map(months.map((m) => [monthKey(m), m.txCount]));
  const years = new Set([current.year, ...months.map((m) => m.year)]);
  return [...years]
    .sort((a, b) => b - a)
    .map((year) => ({
      year,
      cells: MONTH_SHORT.map((_, i) => {
        const month = i + 1;
        const key = monthKey({ year, month });
        const count = counts.get(key) ?? 0;
        const isCurrent = isSameMonth({ year, month }, current);
        const enabled =
          count > 0 || isCurrent || (enableAllMonths && counts.has(key));
        return { month, count, enabled, isCurrent };
      }),
    }));
};

/** UTC midnight on the 1st, so the wire value cannot drift across timezones. */
export const firstOfMonthApiDate = (ym: YearMonth): string =>
  toApiDate(new Date(ym.year, ym.month - 1, 1));
