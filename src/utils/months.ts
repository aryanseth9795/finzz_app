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

export const currentYearMonth = (now: Date): YearMonth => ({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
});

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

export const yearGrid = (
  months: IAvailableMonth[],
  now: Date,
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
        const count = counts.get(monthKey({ year, month })) ?? 0;
        const isCurrent = isSameMonth({ year, month }, current);
        return { month, count, enabled: count > 0 || isCurrent, isCurrent };
      }),
    }));
};

/** UTC midnight on the 1st, so the wire value cannot drift across timezones. */
export const firstOfMonthApiDate = (ym: YearMonth): string =>
  toApiDate(new Date(ym.year, ym.month - 1, 1));
