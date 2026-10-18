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

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthIndex = ({ year, month }: YearMonth): number => year * 12 + (month - 1);
const todayIndex = (today: Date): number => today.getFullYear() * 12 + today.getMonth();
const isCurrentMonth = (ym: YearMonth, today: Date | undefined): boolean =>
  today !== undefined && monthIndex(ym) === todayIndex(today);
/** Days of the current month so far, today included, clamped to 1..daysInMonth. */
const daysElapsedIn = (ym: YearMonth, today: Date): number =>
  Math.min(Math.max(today.getDate(), 1), daysIn(ym.year, ym.month));

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

/**
 * Selected month vs the previous CALENDAR month; a missing month counts as 0.
 * When `today` is given and `selected` is the current month, the previous
 * month is PRO-RATED to daysElapsed / daysInPrevMonth (capped at a full
 * month), so the comparison is "so far this month vs the same point last month".
 */
export const monthOverMonth = (trend: Trend, selected: YearMonth, today?: Date): MonthOverMonth => {
  const prevYm = shiftMonth(selected, -1);
  const cur = findMonth(trend, selected);
  const prev = findMonth(trend, prevYm);
  let scale = (v: number): number => v;
  if (today && isCurrentMonth(selected, today)) {
    const elapsed = daysElapsedIn(selected, today);
    const prevDays = daysIn(prevYm.year, prevYm.month);
    if (elapsed < prevDays) scale = (v) => (v * elapsed) / prevDays;
  }
  return {
    spend: pctChange(cur?.debitTotal ?? 0, scale(prev?.debitTotal ?? 0)),
    income: pctChange(cur?.creditTotal ?? 0, scale(prev?.creditTotal ?? 0)),
    net: pctChange(cur?.net ?? 0, scale(prev?.net ?? 0)),
  };
};

const priorThreeMonths = (trend: Trend, selected: YearMonth): Trend =>
  [-1, -2, -3].map((delta) => findMonth(trend, shiftMonth(selected, delta))).filter((r): r is Trend[number] => !!r);

/**
 * Mean spend of the months PRESENT among the 3 calendar months before
 * `selected`. Null if none is present. See threeMonthAverageMonths for the count.
 */
export const threeMonthAverageSpend = (trend: Trend, selected: YearMonth): number | null => {
  const rows = priorThreeMonths(trend, selected);
  if (rows.length === 0) return null;
  const sum = rows.reduce((a, r) => a + (finite(r.debitTotal) ? r.debitTotal : 0), 0);
  return sum / rows.length;
};

/** How many of the 3 calendar months before `selected` were averaged (0-3). */
export const threeMonthAverageMonths = (trend: Trend, selected: YearMonth): number =>
  priorThreeMonths(trend, selected).length;

export interface MonthProjection {
  projected: number;
  daysElapsed: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
  /** Current month, under 7 days in, with no 3-month average: nothing to project from. */
  tooEarly?: boolean;
}

/** Below this many elapsed days the month's own burn rate is not trusted. */
const EARLY_DAYS = 7;

/**
 * Month-end spend for the current month. Past months return the actual
 * spend; future months return the spend so far with 0 days elapsed.
 *
 * Current month (avgRate = threeMonthAvg / daysInMonth, recentRate = spend / daysElapsed):
 *  - under 7 days: spend + avgRate * daysLeft when an average exists,
 *    otherwise `tooEarly: true` with projected = spend so far;
 *  - 7 days or more: spend + max(avgRate, recentRate) * daysLeft.
 * Lumpy early payments (rent on day 1) are therefore never extrapolated in
 * the first week.
 */
export const projectMonthEnd = (
  spendSoFar: number,
  selected: YearMonth,
  today: Date,
  threeMonthAvg?: number | null,
): MonthProjection => {
  const daysInMonth = daysIn(selected.year, selected.month);
  const spend = finite(spendSoFar) ? spendSoFar : 0;
  const todayIdx = todayIndex(today);
  const selectedIdx = monthIndex(selected);

  if (selectedIdx < todayIdx) {
    return { projected: spend, daysElapsed: daysInMonth, daysInMonth, isCurrentMonth: false };
  }
  if (selectedIdx > todayIdx) {
    return { projected: spend, daysElapsed: 0, daysInMonth, isCurrentMonth: false };
  }
  const daysElapsed = daysElapsedIn(selected, today);
  const daysLeft = daysInMonth - daysElapsed;
  const hasAvg = finite(threeMonthAvg) && threeMonthAvg >= 0;
  const avgRate = hasAvg ? threeMonthAvg / daysInMonth : 0;
  const base = { daysElapsed, daysInMonth, isCurrentMonth: true };

  if (daysElapsed < EARLY_DAYS) {
    if (!hasAvg) return { projected: spend, ...base, tooEarly: true };
    return { projected: round2(spend + avgRate * daysLeft), ...base };
  }
  const recentRate = spend / daysElapsed;
  if (!hasAvg) return { projected: round2(spend + recentRate * daysLeft), ...base };
  // Trust this month's pace in proportion to how much of it has passed, so an
  // early lump sum (rent) doesn't dominate, but a genuinely fast month still shows.
  const w = daysElapsed / daysInMonth;
  const rate = w * recentRate + (1 - w) * avgRate;
  return { projected: round2(spend + rate * daysLeft), ...base };
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

/**
 * Days with no debit among days 1..upToDay, and the longest consecutive run
 * of them. When `today` is given and falls in this month, today is excluded
 * (only days 1..today-1 count), since it is not over yet.
 */
export const noSpendStats = (
  daily: Daily,
  year: number,
  month: number,
  upToDay?: number,
  today?: Date,
): { noSpendDays: number; longestStreak: number } => {
  let limit = dayLimit(year, month, upToDay);
  if (today && isCurrentMonth({ year, month }, today)) {
    limit = Math.min(limit, Math.max(0, today.getDate() - 1));
  }
  const perDay = debitsByDay(daily, year, month, limit);
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

/**
 * Months with the highest and lowest net. Ties keep the earliest month.
 * When `today` is given, the current (partial) month and any later month are
 * excluded.
 */
export const bestWorstMonth = (
  trend: Trend,
  today?: Date,
): { bestNet: MonthNet | null; worstNet: MonthNet | null } => {
  let best: Trend[number] | null = null;
  let worst: Trend[number] | null = null;
  const cutoff = today ? todayIndex(today) : Infinity;
  for (const row of trend ?? []) {
    if (!finite(row.net)) continue;
    if (monthIndex({ year: row.year, month: row.monthNum }) >= cutoff) continue;
    if (!best || row.net > best.net) best = row;
    if (!worst || row.net < worst.net) worst = row;
  }
  const pick = (r: Trend[number] | null): MonthNet | null =>
    r ? { month: r.month, year: r.year, monthNum: r.monthNum, net: r.net } : null;
  return { bestNet: pick(best), worstNet: pick(worst) };
};

export interface FilledMonth {
  year: number;
  monthNum: number;
  /** "YYYY-MM", the same shape the server sends in monthlyTrend. */
  month: string;
  /** "Oct", or "Oct '25" when the year differs from the selected month's. */
  label: string;
  debitTotal: number;
  creditTotal: number;
  net: number;
}

/**
 * Exactly `months` entries ending at `selected` (oldest first), with months
 * missing from the trend zero-filled.
 */
export const zeroFillTrend = (trend: Trend, selected: YearMonth, months = 12): FilledMonth[] => {
  const n = finite(months) ? Math.max(0, Math.floor(months)) : 0;
  const out: FilledMonth[] = [];
  for (let back = n - 1; back >= 0; back--) {
    const ym = shiftMonth(selected, -back);
    const row = findMonth(trend, ym);
    const debitTotal = finite(row?.debitTotal) ? row.debitTotal : 0;
    const creditTotal = finite(row?.creditTotal) ? row.creditTotal : 0;
    const short = MONTH_SHORT[ym.month - 1];
    out.push({
      year: ym.year,
      monthNum: ym.month,
      month: `${ym.year}-${String(ym.month).padStart(2, "0")}`,
      label: ym.year === selected.year ? short : `${short} '${String(((ym.year % 100) + 100) % 100).padStart(2, "0")}`,
      debitTotal,
      creditTotal,
      net: finite(row?.net) ? row.net : creditTotal - debitTotal,
    });
  }
  return out;
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

/** 2.5 -> "2.5", 2.0 -> "2". */
const oneDecimal = (n: number): string => String(Math.round(n * 10) / 10);

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
  const avg = threeMonthAverageSpend(trend, sel);
  const avgMonths = threeMonthAverageMonths(trend, sel);
  const proj = projectMonthEnd(spend, sel, today, avg);
  const current = isCurrentMonth(sel, today);
  // "this month" for the current month, "in October" otherwise.
  const period = current ? "this month" : `in ${MONTH_LONG[sel.month - 1]}`;

  // 1. Savings
  const rate = savingsRate(income, spend);
  if (rate !== null) {
    if (rate < 0) {
      const times = Math.round((spend / income) * 10) / 10;
      out.push({
        kind: "savings",
        text:
          times > 1
            ? `You spent ${oneDecimal(times)}× your income ${period}.`
            : `You spent more than you earned ${period}.`,
        tone: "negative",
      });
    } else if (Math.round(rate) >= 1) {
      out.push({
        kind: "savings",
        text: `You saved ${Math.round(rate)}% of your income ${period}.`,
        tone: "positive",
      });
    }
  }

  // 2. Pace (current month only; skipped when it is too early to project)
  if (proj.isCurrentMonth && !proj.tooEarly && spend > 0) {
    const diff = avg !== null ? pctChange(proj.projected, avg) : null;
    const base = `On pace to spend about ${formatCurrency(Math.round(proj.projected))} this month`;
    const avgName = `your ${avgMonths}-month average`;
    if (diff === null) {
      out.push({ kind: "pace", text: `${base}.`, tone: "neutral" });
    } else if (Math.abs(diff) < PACE_TOLERANCE) {
      out.push({ kind: "pace", text: `${base} — in line with ${avgName}.`, tone: "neutral" });
    } else if (diff > 0) {
      out.push({
        kind: "pace",
        text: `${base} — ${Math.round(diff)}% above ${avgName}.`,
        tone: "warning",
      });
    } else {
      out.push({
        kind: "pace",
        text: `${base} — ${Math.round(-diff)}% below ${avgName}.`,
        tone: "positive",
      });
    }
  }

  // 3. Month over month spend (current month: vs the same point last month)
  const mom = monthOverMonth(trend, sel, today).spend;
  if (mom !== null && Math.abs(mom) >= MOM_THRESHOLD && Math.round(Math.abs(mom)) >= 1) {
    const pct = Math.round(Math.abs(mom));
    const dir = mom > 0 ? "higher" : "lower";
    const text = current
      ? `Spending so far this month is ${pct}% ${dir} than at the same point last month.`
      : `Spending in ${MONTH_LONG[sel.month - 1]} was ${pct}% ${dir} than in ${
          MONTH_LONG[shiftMonth(sel, -1).month - 1]
        }.`;
    out.push({ kind: "mom", text, tone: mom > 0 ? "warning" : "positive" });
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
    const ns = noSpendStats(daily, sel.year, sel.month, proj.daysElapsed, today);
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
