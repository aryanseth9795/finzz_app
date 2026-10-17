/**
 * Pure analytics for the expense report screen.
 *
 * Conventions
 *  - Every "share"/"rate"/"change" is a PERCENT (23 means 23%), unrounded.
 *  - Date strings are "YYYY-MM-DD" and are parsed from the string itself; the
 *    weekday uses Date.UTC + getUTCDay so the device timezone cannot shift a
 *    day. The only local-time input is the `today` Date handed in by callers.
 *  - Nothing here returns NaN/Infinity: undefined results are `null`.
 */

import type { IAdvancedExpenseStats } from "../types";
import { formatCurrency } from "./money";

type Trend = IAdvancedExpenseStats["monthlyTrend"];
type Daily = IAdvancedExpenseStats["dailyBreakdown"];
type Categories = IAdvancedExpenseStats["categoryBreakdown"];

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const round2 = (n: number): number => Math.round(n * 100) / 100;

const daysIn = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

const parseYmd = (s: string): { y: number; m: number; d: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
};

const shiftMonth = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
};

const findMonth = (trend: Trend, ym: YearMonth): Trend[number] | undefined =>
  (trend ?? []).find((t) => t.year === ym.year && t.monthNum === ym.month);

/** (income - spend) / income, percent. Null when income is not positive. */
export const savingsRate = (income: number, spend: number): number | null => {
  if (!finite(income) || !finite(spend) || income <= 0) return null;
  return ((income - spend) / income) * 100;
};

/**
 * Percent change from previous to current. Null when previous is 0. Uses
 * |previous| as the base so a net moving from -100 to -50 reads as +50%.
 */
export const pctChange = (current: number, previous: number): number | null => {
  if (!finite(current) || !finite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export interface MonthOverMonth {
  spend: number | null;
  income: number | null;
  net: number | null;
}

/** Selected month vs the previous CALENDAR month; a missing month counts as 0. */
export const monthOverMonth = (trend: Trend, selected: YearMonth): MonthOverMonth => {
  const cur = findMonth(trend, selected);
  const prev = findMonth(trend, shiftMonth(selected, -1));
  return {
    spend: pctChange(cur?.debitTotal ?? 0, prev?.debitTotal ?? 0),
    income: pctChange(cur?.creditTotal ?? 0, prev?.creditTotal ?? 0),
    net: pctChange(cur?.net ?? 0, prev?.net ?? 0),
  };
};

/** Mean spend of the 3 calendar months before `selected` (missing = 0). Null if all missing. */
export const threeMonthAverageSpend = (trend: Trend, selected: YearMonth): number | null => {
  let sum = 0;
  let present = 0;
  for (const delta of [-1, -2, -3]) {
    const row = findMonth(trend, shiftMonth(selected, delta));
    if (row) {
      present += 1;
      sum += row.debitTotal;
    }
  }
  return present === 0 ? null : sum / 3;
};

export interface MonthProjection {
  projected: number;
  daysElapsed: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
}

/**
 * Month-end spend at the current burn rate. Past months return the actual
 * spend; future months return the spend so far with 0 days elapsed.
 */
export const projectMonthEnd = (spendSoFar: number, selected: YearMonth, today: Date): MonthProjection => {
  const daysInMonth = daysIn(selected.year, selected.month);
  const spend = finite(spendSoFar) ? spendSoFar : 0;
  const todayIdx = today.getFullYear() * 12 + today.getMonth();
  const selectedIdx = selected.year * 12 + (selected.month - 1);

  if (selectedIdx < todayIdx) {
    return { projected: spend, daysElapsed: daysInMonth, daysInMonth, isCurrentMonth: false };
  }
  if (selectedIdx > todayIdx) {
    return { projected: spend, daysElapsed: 0, daysInMonth, isCurrentMonth: false };
  }
  const daysElapsed = Math.min(Math.max(today.getDate(), 1), daysInMonth);
  return {
    projected: round2((spend * daysInMonth) / daysElapsed),
    daysElapsed,
    daysInMonth,
    isCurrentMonth: true,
  };
};

const dayLimit = (year: number, month: number, upToDay?: number): number => {
  const dim = daysIn(year, month);
  if (upToDay === undefined) return dim;
  return Math.max(0, Math.min(Math.floor(upToDay), dim));
};

/** Debit totals per day-of-month (index 0 = day 1) for one month. */
const debitsByDay = (daily: Daily, year: number, month: number, limit: number): number[] => {
  const out = new Array<number>(limit).fill(0);
  for (const row of daily ?? []) {
    const p = parseYmd(row.date);
    if (!p || p.y !== year || p.m !== month || p.d > limit) continue;
    out[p.d - 1] += finite(row.debitTotal) ? row.debitTotal : 0;
  }
  return out;
};

/** Running debit total for days 1..upToDay (default: whole month) of one month. */
export const cumulativeSeries = (daily: Daily, year: number, month: number, upToDay?: number): number[] => {
  const perDay = debitsByDay(daily, year, month, dayLimit(year, month, upToDay));
  let run = 0;
  return perDay.map((v) => (run += v));
};

/** Days with no debit among days 1..upToDay, and the longest consecutive run of them. */
export const noSpendStats = (
  daily: Daily,
  year: number,
  month: number,
  upToDay?: number,
): { noSpendDays: number; longestStreak: number } => {
  const perDay = debitsByDay(daily, year, month, dayLimit(year, month, upToDay));
  let noSpendDays = 0;
  let longestStreak = 0;
  let streak = 0;
  for (const v of perDay) {
    if (v > 0) {
      streak = 0;
    } else {
      noSpendDays += 1;
      streak += 1;
      if (streak > longestStreak) longestStreak = streak;
    }
  }
  return { noSpendDays, longestStreak };
};

/** Debit totals by weekday, index 0 = Sunday .. 6 = Saturday. */
export const weekdayTotals = (daily: Daily): number[] => {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const row of daily ?? []) {
    const p = parseYmd(row.date);
    if (!p) continue;
    const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    out[dow] += finite(row.debitTotal) ? row.debitTotal : 0;
  }
  return out;
};

/** Saturday + Sunday share of debits, percent. Null when there is no spend. */
export const weekendShare = (daily: Daily): number | null => {
  const w = weekdayTotals(daily);
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  return ((w[0] + w[6]) / total) * 100;
};

/** Debit totals for days 1-7, 8-14, 15-21, 22-28, 29-31. */
export const weekOfMonthTotals = (daily: Daily): number[] => {
  const out = [0, 0, 0, 0, 0];
  for (const row of daily ?? []) {
    const p = parseYmd(row.date);
    if (!p) continue;
    out[Math.min(Math.floor((p.d - 1) / 7), 4)] += finite(row.debitTotal) ? row.debitTotal : 0;
  }
  return out;
};

/** Share of category spend held by the top `n` categories, percent. Null when empty/zero. */
export const topConcentration = (categories: Categories, n = 3): number | null => {
  const totals = (categories ?? []).map((c) => (finite(c.total) ? c.total : 0)).sort((a, b) => b - a);
  const all = totals.reduce((a, b) => a + b, 0);
  if (all <= 0) return null;
  return (totals.slice(0, n).reduce((a, b) => a + b, 0) / all) * 100;
};

export const averageTicket = (total: number, count: number): number | null => {
  if (!finite(total) || !finite(count) || count <= 0) return null;
  return total / count;
};

export interface MonthNet {
  month: string;
  year: number;
  monthNum: number;
  net: number;
}

/** Months with the highest and lowest net. Ties keep the earliest month. */
export const bestWorstMonth = (trend: Trend): { bestNet: MonthNet | null; worstNet: MonthNet | null } => {
  let best: Trend[number] | null = null;
  let worst: Trend[number] | null = null;
  for (const row of trend ?? []) {
    if (!finite(row.net)) continue;
    if (!best || row.net > best.net) best = row;
    if (!worst || row.net < worst.net) worst = row;
  }
  const pick = (r: Trend[number] | null): MonthNet | null =>
    r ? { month: r.month, year: r.year, monthNum: r.monthNum, net: r.net } : null;
  return { bestNet: pick(best), worstNet: pick(worst) };
};

export interface ExpenseInsight {
  kind: string;
  text: string;
  tone: "positive" | "negative" | "neutral" | "warning";
}

const MAX_INSIGHTS = 5;
/** Share (percent) above which a concentration sentence is worth saying. */
const CONCENTRATION_THRESHOLD = 35;
/** Month-over-month swing (percent) below which we stay quiet. */
const MOM_THRESHOLD = 10;
/** Pace within this many percent of the average reads as "in line". */
const PACE_TOLERANCE = 5;
/** First-week share is meaningless until the month is mostly done. */
const FIRST_WEEK_MIN_DAYS = 14;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** 3-5 plain-language takeaways, most important first. Empty when nothing applies. */
export const buildExpenseInsights = (stats: IAdvancedExpenseStats, today: Date): ExpenseInsight[] => {
  const out: ExpenseInsight[] = [];
  const sel = stats?.selectedMonth;
  if (!stats || !sel) return out;

  const daily = stats.dailyBreakdown ?? [];
  const categories = stats.categoryBreakdown ?? [];
  const trend = stats.monthlyTrend ?? [];
  const income = finite(stats.summary?.totalCredits) ? stats.summary.totalCredits : 0;
  const spend = finite(stats.summary?.totalDebits) ? stats.summary.totalDebits : 0;
  const proj = projectMonthEnd(spend, sel, today);

  // 1. Savings
  const rate = savingsRate(income, spend);
  if (rate !== null) {
    if (rate < 0) {
      out.push({ kind: "savings", text: "You spent more than you earned this month.", tone: "negative" });
    } else if (Math.round(rate) >= 1) {
      out.push({
        kind: "savings",
        text: `You saved ${Math.round(rate)}% of your income this month.`,
        tone: "positive",
      });
    }
  }

  // 2. Pace (current month only)
  if (proj.isCurrentMonth && spend > 0) {
    const avg = threeMonthAverageSpend(trend, sel);
    const diff = avg !== null ? pctChange(proj.projected, avg) : null;
    const base = `On pace to spend ${formatCurrency(proj.projected)} this month`;
    if (diff === null) {
      out.push({ kind: "pace", text: `${base}.`, tone: "neutral" });
    } else if (Math.abs(diff) < PACE_TOLERANCE) {
      out.push({ kind: "pace", text: `${base} — in line with your 3-month average.`, tone: "neutral" });
    } else if (diff > 0) {
      out.push({
        kind: "pace",
        text: `${base} — ${Math.round(diff)}% above your 3-month average.`,
        tone: "warning",
      });
    } else {
      out.push({
        kind: "pace",
        text: `${base} — ${Math.round(-diff)}% below your 3-month average.`,
        tone: "positive",
      });
    }
  }

  // 3. Month over month spend
  const mom = monthOverMonth(trend, sel).spend;
  if (mom !== null && Math.abs(mom) >= MOM_THRESHOLD && Math.round(Math.abs(mom)) >= 1) {
    out.push(
      mom > 0
        ? { kind: "mom", text: `Spending is ${Math.round(mom)}% higher than last month.`, tone: "warning" }
        : { kind: "mom", text: `Spending is ${Math.round(-mom)}% lower than last month.`, tone: "positive" },
    );
  }

  // 4. Biggest category
  const catSum = categories.reduce((a, c) => a + (finite(c.total) ? c.total : 0), 0);
  if (catSum > 0) {
    const top = [...categories].sort((a, b) => b.total - a.total)[0];
    if (top && top.total > 0) {
      out.push({
        kind: "category",
        text: `${top.name} is your biggest category at ${Math.round((top.total / catSum) * 100)}% of spending.`,
        tone: "neutral",
      });
    }
  }

  // 5. First week
  const weeks = weekOfMonthTotals(daily);
  const weekSum = weeks.reduce((a, b) => a + b, 0);
  if (weekSum > 0 && (!proj.isCurrentMonth || proj.daysElapsed >= FIRST_WEEK_MIN_DAYS)) {
    const share = (weeks[0] / weekSum) * 100;
    if (share >= CONCENTRATION_THRESHOLD) {
      out.push({
        kind: "firstWeek",
        text: `${Math.round(share)}% of spending happened in the first week.`,
        tone: "warning",
      });
    }
  }

  // 6. Weekends
  const wk = weekendShare(daily);
  if (wk !== null && wk >= CONCENTRATION_THRESHOLD) {
    out.push({ kind: "weekend", text: `Weekends were ${Math.round(wk)}% of spending.`, tone: "neutral" });
  }

  // 7. No-spend days
  if (spend > 0 && proj.daysElapsed > 0) {
    const ns = noSpendStats(daily, sel.year, sel.month, proj.daysElapsed);
    if (ns.noSpendDays >= 1) {
      out.push({
        kind: "noSpend",
        text: `${plural(ns.noSpendDays, "no-spend day", "no-spend days")}, longest streak ${plural(ns.longestStreak, "day", "days")}.`,
        tone: "positive",
      });
    }
  }

  return out.slice(0, MAX_INSIGHTS);
};
