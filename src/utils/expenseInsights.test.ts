import { describe, expect, it } from "vitest";
import type { IAdvancedExpenseStats } from "../types";
import {
  averageTicket,
  bestWorstMonth,
  buildExpenseInsights,
  cumulativeSeries,
  monthOverMonth,
  noSpendStats,
  pctChange,
  projectMonthEnd,
  savingsRate,
  threeMonthAverageMonths,
  threeMonthAverageSpend,
  topConcentration,
  weekdayTotals,
  weekendShare,
  weekOfMonthTotals,
  zeroFillTrend,
} from "./expenseInsights";

type Trend = IAdvancedExpenseStats["monthlyTrend"];
type Daily = IAdvancedExpenseStats["dailyBreakdown"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const t = (year: number, monthNum: number, debit: number, credit: number): Trend[number] => ({
  month: MONTHS[monthNum - 1],
  year,
  monthNum,
  debitTotal: debit,
  creditTotal: credit,
  debitCount: debit > 0 ? 1 : 0,
  creditCount: credit > 0 ? 1 : 0,
  net: credit - debit,
});

const d = (date: string, debit: number, credit = 0): Daily[number] => ({
  date,
  debitTotal: debit,
  creditTotal: credit,
  debitCount: debit > 0 ? 1 : 0,
  creditCount: credit > 0 ? 1 : 0,
  net: credit - debit,
});

describe("savingsRate", () => {
  it("is net over income as a percent", () => {
    expect(savingsRate(10000, 7700)).toBeCloseTo(23, 10);
  });
  it("is null for zero or negative income", () => {
    expect(savingsRate(0, 500)).toBeNull();
    expect(savingsRate(-5, 0)).toBeNull();
  });
  it("is negative when overspending", () => {
    expect(savingsRate(1000, 1500)).toBe(-50);
  });
  it("is null for non-finite input", () => {
    expect(savingsRate(NaN, 1)).toBeNull();
  });
});

describe("pctChange", () => {
  it("computes percent change", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
  });
  it("is null when previous is 0", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
  });
  it("uses the magnitude of a negative previous", () => {
    // from -100 up to -50 is an improvement of 50%
    expect(pctChange(-50, -100)).toBe(50);
  });
});

describe("monthOverMonth", () => {
  const trend: Trend = [t(2026, 9, 1000, 2000), t(2026, 10, 1500, 2000)];
  it("compares with the previous calendar month", () => {
    const r = monthOverMonth(trend, { year: 2026, month: 10 });
    expect(r.spend).toBe(50);
    expect(r.income).toBe(0);
    expect(r.net).toBe(-50); // 1000 -> 500
  });
  it("returns nulls when the previous month is missing (counts as 0)", () => {
    const r = monthOverMonth([t(2026, 10, 1500, 2000)], { year: 2026, month: 10 });
    expect(r).toEqual({ spend: null, income: null, net: null });
  });
  it("treats a missing selected month as 0", () => {
    const r = monthOverMonth([t(2026, 9, 1000, 2000)], { year: 2026, month: 10 });
    expect(r.spend).toBe(-100);
    expect(r.income).toBe(-100);
  });
  it("does not skip a gap: a missing previous month is not the last present one", () => {
    const r = monthOverMonth([t(2026, 8, 1000, 0), t(2026, 10, 500, 0)], { year: 2026, month: 10 });
    expect(r.spend).toBeNull();
  });
  it("pro-rates the previous month when the selected month is the current one", () => {
    // 10th of October; September (30 days) spent 30000, October so far 10000.
    const trend = [t(2026, 9, 30000, 60000), t(2026, 10, 10000, 20000)];
    const r = monthOverMonth(trend, { year: 2026, month: 10 }, new Date(2026, 9, 10));
    expect(r.spend).toBeCloseTo(0, 10);
    expect(r.income).toBeCloseTo(0, 10);
    expect(r.net).toBeCloseTo(0, 10);
    // without `today` it is the raw calendar comparison (-66.7%)
    expect(monthOverMonth(trend, { year: 2026, month: 10 }).spend).toBeCloseTo(-66.67, 1);
  });
  it("does not pro-rate a past month", () => {
    const trend = [t(2026, 8, 1000, 0), t(2026, 9, 1500, 0)];
    expect(monthOverMonth(trend, { year: 2026, month: 9 }, new Date(2026, 9, 10)).spend).toBe(50);
  });
  it("caps the pro-rating factor at a full previous month", () => {
    // 31 Oct vs a 30-day September: factor capped at 1
    const trend = [t(2026, 9, 3000, 0), t(2026, 10, 3000, 0)];
    expect(monthOverMonth(trend, { year: 2026, month: 10 }, new Date(2026, 9, 31)).spend).toBe(0);
  });
  it("January looks at the previous December", () => {
    const r = monthOverMonth([t(2025, 12, 200, 100), t(2026, 1, 300, 100)], {
      year: 2026,
      month: 1,
    });
    expect(r.spend).toBe(50);
    expect(r.income).toBe(0);
  });
});

describe("threeMonthAverageSpend", () => {
  it("averages the three calendar months before the selected one", () => {
    const trend = [t(2026, 7, 300, 0), t(2026, 8, 600, 0), t(2026, 9, 900, 0), t(2026, 10, 5000, 0)];
    expect(threeMonthAverageSpend(trend, { year: 2026, month: 10 })).toBe(600);
  });
  it("divides by the number of months present, not by 3", () => {
    const trend = [t(2026, 9, 900, 0)];
    expect(threeMonthAverageSpend(trend, { year: 2026, month: 10 })).toBe(900);
    expect(threeMonthAverageSpend([t(2026, 7, 300, 0), t(2026, 9, 900, 0)], { year: 2026, month: 10 })).toBe(600);
  });
  it("is null when all three are missing", () => {
    expect(threeMonthAverageSpend([t(2026, 10, 100, 0)], { year: 2026, month: 10 })).toBeNull();
    expect(threeMonthAverageSpend([], { year: 2026, month: 10 })).toBeNull();
  });
  it("wraps across the year boundary", () => {
    const trend = [t(2025, 10, 300, 0), t(2025, 11, 300, 0), t(2025, 12, 300, 0)];
    expect(threeMonthAverageSpend(trend, { year: 2026, month: 1 })).toBe(300);
    expect(threeMonthAverageSpend(trend, { year: 2026, month: 2 })).toBe(300);
  });
});

describe("threeMonthAverageMonths", () => {
  it("counts the months that were averaged", () => {
    const trend = [t(2026, 7, 300, 0), t(2026, 8, 600, 0), t(2026, 9, 900, 0), t(2026, 10, 5000, 0)];
    expect(threeMonthAverageMonths(trend, { year: 2026, month: 10 })).toBe(3);
    expect(threeMonthAverageMonths([t(2026, 7, 1, 0), t(2026, 9, 1, 0)], { year: 2026, month: 10 })).toBe(2);
    expect(threeMonthAverageMonths([t(2026, 10, 1, 0)], { year: 2026, month: 10 })).toBe(0);
    expect(threeMonthAverageMonths([], { year: 2026, month: 10 })).toBe(0);
  });
  it("wraps across the year boundary", () => {
    const trend = [t(2025, 11, 300, 0), t(2025, 12, 300, 0)];
    expect(threeMonthAverageMonths(trend, { year: 2026, month: 2 })).toBe(2);
  });
});

describe("projectMonthEnd", () => {
  it("scales the burn rate for the current month", () => {
    const r = projectMonthEnd(10000, { year: 2026, month: 10 }, new Date(2026, 9, 10));
    expect(r).toEqual({ projected: 31000, daysElapsed: 10, daysInMonth: 31, isCurrentMonth: true });
  });
  it("returns the actual spend for a past month", () => {
    const r = projectMonthEnd(12345, { year: 2026, month: 9 }, new Date(2026, 9, 10));
    expect(r).toEqual({ projected: 12345, daysElapsed: 30, daysInMonth: 30, isCurrentMonth: false });
  });
  it("handles a leap February", () => {
    const r = projectMonthEnd(1450, { year: 2024, month: 2 }, new Date(2024, 1, 10));
    expect(r.daysInMonth).toBe(29);
    expect(r.projected).toBe(4205);
    expect(projectMonthEnd(0, { year: 2026, month: 2 }, new Date(2027, 0, 1)).daysInMonth).toBe(28);
    expect(projectMonthEnd(0, { year: 1900, month: 2 }, new Date(2027, 0, 1)).daysInMonth).toBe(28);
  });
  it("on the last day projects exactly the spend so far", () => {
    const r = projectMonthEnd(777, { year: 2026, month: 10 }, new Date(2026, 9, 31));
    expect(r.projected).toBe(777);
  });
  it("a future month is not current and projects the spend so far", () => {
    const r = projectMonthEnd(0, { year: 2026, month: 12 }, new Date(2026, 9, 10));
    expect(r.isCurrentMonth).toBe(false);
    expect(r.projected).toBe(0);
    expect(r.daysElapsed).toBe(0);
  });
  it("rounds the projection to paise", () => {
    // 100 + (100/7) * 24 = 442.857...
    const r = projectMonthEnd(100, { year: 2026, month: 10 }, new Date(2026, 9, 7));
    expect(r.projected).toBe(442.86);
  });
  it("does not extrapolate a day-1 rent payment (under 7 days uses the 3-month rate)", () => {
    // 15000 rent on 1 Oct, 30k average: 15000 + 30000/31 * 30 = 44032.26
    const r = projectMonthEnd(15000, { year: 2026, month: 10 }, new Date(2026, 9, 1), 30000);
    expect(r.projected).toBeLessThanOrEqual(45000);
    expect(r.projected).toBe(44032.26);
    expect(r.tooEarly).toBeUndefined();
    expect(r.isCurrentMonth).toBe(true);
  });
  it("is too early under 7 days without a 3-month average", () => {
    const r = projectMonthEnd(15000, { year: 2026, month: 10 }, new Date(2026, 9, 6));
    expect(r).toEqual({ projected: 15000, daysElapsed: 6, daysInMonth: 31, isCurrentMonth: true, tooEarly: true });
    expect(projectMonthEnd(15000, { year: 2026, month: 10 }, new Date(2026, 9, 6), null).tooEarly).toBe(true);
  });
  it("from day 7 uses the higher of the 3-month rate and the recent rate", () => {
    // day 7, slow month: recent 700/7 = 100/day < 31000/31 = 1000/day -> 700 + 1000*24
    expect(projectMonthEnd(700, { year: 2026, month: 10 }, new Date(2026, 9, 7), 31000).projected).toBe(24700);
    // day 10, fast month: recent 20000/10 = 2000/day > 1000/day -> 20000 + 2000*21
    expect(projectMonthEnd(20000, { year: 2026, month: 10 }, new Date(2026, 9, 10), 31000).projected).toBe(62000);
  });
  it("ignores the average for past months", () => {
    const r = projectMonthEnd(5, { year: 2026, month: 9 }, new Date(2026, 9, 2), 30000);
    expect(r).toEqual({ projected: 5, daysElapsed: 30, daysInMonth: 30, isCurrentMonth: false });
  });
});

describe("cumulativeSeries", () => {
  const daily: Daily = [d("2026-10-01", 100), d("2026-10-03", 50), d("2026-10-05", 25), d("2026-09-30", 999)];
  it("builds a running total across the whole month", () => {
    const s = cumulativeSeries(daily, 2026, 10);
    expect(s).toHaveLength(31);
    expect(s.slice(0, 6)).toEqual([100, 100, 150, 150, 175, 175]);
    expect(s[30]).toBe(175);
  });
  it("stops at upToDay", () => {
    expect(cumulativeSeries(daily, 2026, 10, 3)).toEqual([100, 100, 150]);
  });
  it("clamps upToDay to the month length", () => {
    expect(cumulativeSeries([], 2026, 2, 99)).toHaveLength(28);
    expect(cumulativeSeries([], 2024, 2)).toHaveLength(29);
  });
  it("is all zeros with no data", () => {
    expect(cumulativeSeries([], 2026, 10, 3)).toEqual([0, 0, 0]);
  });
  it("returns [] for upToDay 0", () => {
    expect(cumulativeSeries(daily, 2026, 10, 0)).toEqual([]);
  });
});

describe("noSpendStats", () => {
  it("counts days without debits and the longest streak", () => {
    // days 1..10; spend on 1, 4, 5 -> no-spend: 2,3 | 6..10 (5 days)
    const daily = [d("2026-10-01", 10), d("2026-10-04", 5), d("2026-10-05", 5)];
    expect(noSpendStats(daily, 2026, 10, 10)).toEqual({ noSpendDays: 7, longestStreak: 5 });
  });
  it("treats credit-only days as no-spend", () => {
    expect(noSpendStats([d("2026-10-02", 0, 500)], 2026, 10, 3)).toEqual({
      noSpendDays: 3,
      longestStreak: 3,
    });
  });
  it("uses the full month when upToDay is omitted", () => {
    expect(noSpendStats([], 2024, 2)).toEqual({ noSpendDays: 29, longestStreak: 29 });
  });
  it("ignores other months", () => {
    expect(noSpendStats([d("2026-09-02", 50)], 2026, 10, 5)).toEqual({ noSpendDays: 5, longestStreak: 5 });
  });
  it("excludes today for the current month", () => {
    // 10 Oct: only days 1..9 count; spend on day 2
    const daily = [d("2026-10-02", 10)];
    expect(noSpendStats(daily, 2026, 10, 10, new Date(2026, 9, 10))).toEqual({ noSpendDays: 8, longestStreak: 7 });
    expect(noSpendStats(daily, 2026, 10, undefined, new Date(2026, 9, 10))).toEqual({
      noSpendDays: 8,
      longestStreak: 7,
    });
    // day 1: nothing has finished yet
    expect(noSpendStats([], 2026, 10, 1, new Date(2026, 9, 1))).toEqual({ noSpendDays: 0, longestStreak: 0 });
  });
  it("does not trim a past month when today is given", () => {
    expect(noSpendStats([], 2026, 9, undefined, new Date(2026, 9, 10))).toEqual({
      noSpendDays: 30,
      longestStreak: 30,
    });
  });
  it("is zero when every day has spend", () => {
    const daily = [d("2026-02-01", 1), d("2026-02-02", 1)];
    expect(noSpendStats(daily, 2026, 2, 2)).toEqual({ noSpendDays: 0, longestStreak: 0 });
  });
});

describe("weekdayTotals / weekendShare", () => {
  // 2026-10-17 Sat, 10-18 Sun, 10-19 Mon, 10-20 Tue
  const daily = [d("2026-10-17", 100), d("2026-10-18", 50), d("2026-10-19", 200), d("2026-10-20", 150)];
  it("buckets debits Sun..Sat", () => {
    expect(weekdayTotals(daily)).toEqual([50, 200, 150, 0, 0, 0, 100]);
  });
  it("computes the weekend share as a percent", () => {
    expect(weekendShare(daily)).toBe(30);
  });
  it("is null with no spend", () => {
    expect(weekendShare([])).toBeNull();
    expect(weekendShare([d("2026-10-17", 0, 100)])).toBeNull();
  });
  it("is timezone independent (string parsing only)", () => {
    expect(weekdayTotals([d("2026-01-01", 10)])[4]).toBe(10); // Thursday
  });
  it("skips malformed dates", () => {
    expect(weekdayTotals([d("garbage", 10)])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("weekOfMonthTotals", () => {
  it("buckets days 1-7, 8-14, 15-21, 22-28, 29-31", () => {
    const daily = [
      d("2026-10-01", 1),
      d("2026-10-07", 2),
      d("2026-10-08", 4),
      d("2026-10-14", 8),
      d("2026-10-15", 16),
      d("2026-10-21", 32),
      d("2026-10-22", 64),
      d("2026-10-28", 128),
      d("2026-10-29", 256),
      d("2026-10-31", 512),
    ];
    expect(weekOfMonthTotals(daily)).toEqual([3, 12, 48, 192, 768]);
  });
  it("is all zeros when empty", () => {
    expect(weekOfMonthTotals([])).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("topConcentration", () => {
  const cat = (name: string, total: number) => ({ name, total, count: 1, percentage: 0 });
  it("is the top-n share of all category spend", () => {
    const cats = [cat("a", 10), cat("b", 40), cat("c", 30), cat("d", 15), cat("e", 5)];
    expect(topConcentration(cats)).toBe(85);
    expect(topConcentration(cats, 1)).toBe(40);
  });
  it("is 100 when there are fewer than n categories", () => {
    expect(topConcentration([cat("a", 5)])).toBe(100);
  });
  it("is null when empty or zero", () => {
    expect(topConcentration([])).toBeNull();
    expect(topConcentration([cat("a", 0)])).toBeNull();
  });
});

describe("averageTicket", () => {
  it("divides total by count", () => {
    expect(averageTicket(1000, 4)).toBe(250);
  });
  it("is null when count is 0 or invalid", () => {
    expect(averageTicket(1000, 0)).toBeNull();
    expect(averageTicket(1000, NaN)).toBeNull();
  });
});

describe("bestWorstMonth", () => {
  it("picks the highest and lowest net", () => {
    const trend = [t(2026, 8, 100, 500), t(2026, 9, 900, 500), t(2026, 10, 100, 200)];
    const r = bestWorstMonth(trend);
    expect(r.bestNet).toMatchObject({ month: "Aug", net: 400 });
    expect(r.worstNet).toMatchObject({ month: "Sep", net: -400 });
  });
  it("is null/null for an empty trend", () => {
    expect(bestWorstMonth([])).toEqual({ bestNet: null, worstNet: null });
  });
  it("a single month is both best and worst", () => {
    const r = bestWorstMonth([t(2026, 8, 100, 500)]);
    expect(r.bestNet?.net).toBe(400);
    expect(r.worstNet?.net).toBe(400);
  });
  it("excludes the current partial month when today is given", () => {
    const trend = [t(2026, 8, 100, 500), t(2026, 9, 900, 500), t(2026, 10, 0, 9000)];
    const r = bestWorstMonth(trend, new Date(2026, 9, 5));
    expect(r.bestNet).toMatchObject({ year: 2026, monthNum: 8, net: 400 });
    expect(r.worstNet).toMatchObject({ year: 2026, monthNum: 9, net: -400 });
    expect(bestWorstMonth([t(2026, 10, 0, 9000)], new Date(2026, 9, 5))).toEqual({ bestNet: null, worstNet: null });
    // without today the current month still counts (old behaviour)
    expect(bestWorstMonth(trend).bestNet?.monthNum).toBe(10);
  });
});

describe("zeroFillTrend", () => {
  it("returns exactly 12 entries ending at the selected month, zero-filling gaps", () => {
    const trend = [t(2026, 3, 100, 200), t(2026, 10, 50, 0), t(2025, 9, 999, 0)];
    const out = zeroFillTrend(trend, { year: 2026, month: 10 });
    expect(out).toHaveLength(12);
    expect(out[0]).toMatchObject({ year: 2025, monthNum: 11, month: "2025-11", label: "Nov '25" });
    expect(out[11]).toEqual({
      year: 2026,
      monthNum: 10,
      month: "2026-10",
      label: "Oct",
      debitTotal: 50,
      creditTotal: 0,
      net: -50,
    });
    const mar = out.find((m) => m.monthNum === 3);
    expect(mar).toMatchObject({ label: "Mar", debitTotal: 100, creditTotal: 200, net: 100 });
    const jul = out.find((m) => m.monthNum === 7);
    expect(jul).toMatchObject({ debitTotal: 0, creditTotal: 0, net: 0 });
    // the Sep 2025 row is outside the window
    expect(out.some((m) => m.year === 2025 && m.monthNum === 9)).toBe(false);
    expect(out.map((m) => m.label)).toEqual([
      "Nov '25",
      "Dec '25",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
    ]);
  });
  it("honours a custom length and pads the year label to 2 digits", () => {
    const out = zeroFillTrend([], { year: 2009, month: 2 }, 3);
    expect(out.map((m) => m.label)).toEqual(["Dec '08", "Jan", "Feb"]);
    expect(zeroFillTrend(undefined as unknown as Trend, { year: 2026, month: 1 })).toHaveLength(12);
  });
});

describe("buildExpenseInsights", () => {
  const empty = (year: number, month: number): IAdvancedExpenseStats => ({
    selectedMonth: { year, month },
    summary: {
      totalDebits: 0,
      totalCredits: 0,
      net: 0,
      debitCount: 0,
      creditCount: 0,
      avgDailyDebit: 0,
      avgDailyCredit: 0,
      activeDays: 0,
    },
    monthlyTrend: [],
    dailyBreakdown: [],
    categoryBreakdown: [],
    top5Expenses: [],
  });

  it("returns no insights and no NaN for empty data", () => {
    const out = buildExpenseInsights(empty(2026, 10), new Date(2026, 9, 17));
    expect(out).toEqual([]);
  });

  it("is safe when optional arrays are missing", () => {
    const bad = { ...empty(2026, 10), dailyBreakdown: undefined, categoryBreakdown: undefined, monthlyTrend: undefined };
    expect(buildExpenseInsights(bad as unknown as IAdvancedExpenseStats, new Date(2026, 9, 17))).toEqual([]);
  });

  // Past month (Sep 2026, 30 days): income 10000, spend 7700.
  const past = (): IAdvancedExpenseStats => ({
    ...empty(2026, 9),
    summary: {
      totalDebits: 7700,
      totalCredits: 10000,
      net: 2300,
      debitCount: 5,
      creditCount: 1,
      avgDailyDebit: 0,
      avgDailyCredit: 0,
      activeDays: 3,
    },
    // 2026-09-05 Sat 3000, 09-06 Sun 500, 09-08 Tue 4200
    dailyBreakdown: [d("2026-09-05", 3000), d("2026-09-06", 500), d("2026-09-08", 4200)],
    categoryBreakdown: [
      { name: "Food", total: 3850, count: 3, percentage: 50 },
      { name: "Rent", total: 3850, count: 2, percentage: 50 },
    ],
    monthlyTrend: [t(2026, 8, 7700, 10000), t(2026, 9, 7700, 10000)],
  });

  it("builds sentences for a past month, with no pace line", () => {
    const out = buildExpenseInsights(past(), new Date(2026, 9, 17));
    const texts = out.map((i) => i.text);
    expect(texts[0]).toBe("You saved 23% of your income in September.");
    expect(out[0].tone).toBe("positive");
    expect(texts.some((x) => x.includes("On pace"))).toBe(false);
    expect(texts).toContain("Food is your biggest category at 50% of spending.");
    expect(texts).toContain("27 no-spend days, longest streak 22 days.");
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.length).toBeLessThanOrEqual(5);
    for (const i of out) {
      expect(i.text).not.toMatch(/NaN|undefined|Infinity/);
      expect(["positive", "negative", "neutral", "warning"]).toContain(i.tone);
    }
  });

  it("flags overspending", () => {
    const s = past();
    s.summary.totalDebits = 12000;
    s.summary.net = -2000;
    const out = buildExpenseInsights(s, new Date(2026, 9, 17));
    expect(out[0].tone).toBe("negative");
    expect(out[0].text).toBe("You spent 1.2× your income in September.");
  });

  it("states a negative savings rate as a multiple of income", () => {
    const s = past();
    s.summary.totalDebits = 25000;
    expect(buildExpenseInsights(s, new Date(2026, 9, 17))[0].text).toBe("You spent 2.5× your income in September.");
    s.summary.totalDebits = 20000;
    expect(buildExpenseInsights(s, new Date(2026, 9, 17))[0].text).toBe("You spent 2× your income in September.");
    // a marginal overspend that rounds to 1.0x keeps the plain sentence
    s.summary.totalDebits = 10300;
    expect(buildExpenseInsights(s, new Date(2026, 9, 17))[0].text).toBe(
      "You spent more than you earned in September.",
    );
  });

  it("says 'this month' for the current month", () => {
    const s = past();
    s.selectedMonth = { year: 2026, month: 10 };
    s.dailyBreakdown = [];
    s.monthlyTrend = [];
    expect(buildExpenseInsights(s, new Date(2026, 9, 17))[0].text).toBe("You saved 23% of your income this month.");
    s.summary.totalDebits = 25000;
    expect(buildExpenseInsights(s, new Date(2026, 9, 17))[0].text).toBe("You spent 2.5× your income this month.");
  });

  it("omits the savings line when income is zero", () => {
    const s = past();
    s.summary.totalCredits = 0;
    s.summary.net = -7700;
    const out = buildExpenseInsights(s, new Date(2026, 9, 17));
    expect(out.some((i) => i.text.includes("saved"))).toBe(false);
  });

  it("reports weekend and first-week concentration when high", () => {
    const s = past();
    // weekend (Sat+Sun) = 3500 of 7700 = 45%; days 1-7 = 3500 = 45%
    const texts = buildExpenseInsights(s, new Date(2026, 9, 17)).map((i) => i.text);
    expect(texts).toContain("Weekends were 45% of spending.");
    expect(texts).toContain("45% of spending happened in the first week.");
  });

  it("includes the pace line for the current month, above the 3-month average", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 10000, totalCredits: 0 },
      dailyBreakdown: [d("2026-10-02", 10000)],
      categoryBreakdown: [{ name: "Food", total: 10000, count: 1, percentage: 100 }],
      // average of Jul..Sep = 27700 / 3 = 9233.33... use clean numbers: 30000/3 = 10000? no: want 12% above.
      monthlyTrend: [t(2026, 7, 0, 0), t(2026, 8, 0, 0), t(2026, 9, 28125, 0)],
    };
    // projection: 10000/10*31 = 31000; avg = 28125/3 = 9375 -> +230.67% -> "231%"
    const out = buildExpenseInsights(s, new Date(2026, 9, 10));
    const pace = out.find((i) => i.kind === "pace");
    expect(pace?.text).toBe("On pace to spend ₹31,000 this month — 231% above your 3-month average.");
    expect(pace?.tone).toBe("warning");
  });

  it("says below the average with a positive tone", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 3100, totalCredits: 0 },
      dailyBreakdown: [d("2026-10-02", 3100)],
      monthlyTrend: [t(2026, 7, 31000, 0), t(2026, 8, 31000, 0), t(2026, 9, 31000, 0)],
    };
    // day 10: recent 310/day < avg 1000/day -> 3100 + 1000*21 = 24100; vs 31000 -> 22.26% below
    const pace = buildExpenseInsights(s, new Date(2026, 9, 10)).find((i) => i.kind === "pace");
    expect(pace?.text).toBe("On pace to spend ₹24,100 this month — 22% below your 3-month average.");
    expect(pace?.tone).toBe("positive");
  });

  it("states the pace plainly when there is no history", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 10000, totalCredits: 0 },
      dailyBreakdown: [d("2026-10-02", 10000)],
    };
    const pace = buildExpenseInsights(s, new Date(2026, 9, 10)).find((i) => i.kind === "pace");
    expect(pace?.text).toBe("On pace to spend ₹31,000 this month.");
    expect(pace?.tone).toBe("neutral");
  });

  it("words the average by the number of months present", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 20000, totalCredits: 0 },
      dailyBreakdown: [d("2026-10-02", 20000)],
      monthlyTrend: [t(2026, 8, 10000, 0), t(2026, 9, 10000, 0)],
    };
    // day 10: avg 10000 over 2 months; recent 2000/day -> 20000 + 2000*21 = 62000 -> 520% above
    const pace = buildExpenseInsights(s, new Date(2026, 9, 10)).find((i) => i.kind === "pace");
    expect(pace?.text).toBe("On pace to spend ₹62,000 this month — 520% above your 2-month average.");
  });

  it("skips the pace line when it is too early to project", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 15000, totalCredits: 0 },
      dailyBreakdown: [d("2026-10-01", 15000)],
    };
    const out = buildExpenseInsights(s, new Date(2026, 9, 3));
    expect(out.find((i) => i.kind === "pace")).toBeUndefined();
  });

  it("projects a day-1 rent payment from the 3-month average", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 15000, totalCredits: 0 },
      dailyBreakdown: [d("2026-10-01", 15000)],
      monthlyTrend: [t(2026, 7, 30000, 0), t(2026, 8, 30000, 0), t(2026, 9, 30000, 0)],
    };
    const pace = buildExpenseInsights(s, new Date(2026, 9, 1)).find((i) => i.kind === "pace");
    expect(pace?.text).toBe("On pace to spend ₹44,032.26 this month — 47% above your 3-month average.");
  });

  it("does not count today as a no-spend day", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 100, totalCredits: 0 },
      // 10 Oct: spend on days 1 and 9; today (10th) has none yet
      dailyBreakdown: [d("2026-10-01", 50), d("2026-10-09", 50)],
    };
    const ns = buildExpenseInsights(s, new Date(2026, 9, 10)).find((i) => i.kind === "noSpend");
    expect(ns?.text).toBe("7 no-spend days, longest streak 7 days.");
  });

  it("compares the current month with the same point last month", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 20000, totalCredits: 0 },
      dailyBreakdown: [d("2026-10-02", 20000)],
      // Sep 30000 pro-rated to the 10th = 10000 -> +100%
      monthlyTrend: [t(2026, 9, 30000, 0), t(2026, 10, 20000, 0)],
    };
    const mom = buildExpenseInsights(s, new Date(2026, 9, 10)).find((i) => i.kind === "mom");
    expect(mom?.text).toBe("Spending so far this month is 100% higher than at the same point last month.");
    expect(mom?.tone).toBe("warning");
  });

  it("stays quiet on month-over-month when on track with last month's pace", () => {
    const s: IAdvancedExpenseStats = {
      ...empty(2026, 10),
      summary: { ...empty(2026, 10).summary, totalDebits: 10000, totalCredits: 0 },
      dailyBreakdown: [d("2026-10-02", 10000)],
      monthlyTrend: [t(2026, 9, 30000, 0), t(2026, 10, 10000, 0)],
    };
    expect(buildExpenseInsights(s, new Date(2026, 9, 10)).find((i) => i.kind === "mom")).toBeUndefined();
  });

  it("never returns more than 5 insights", () => {
    const s = past();
    s.dailyBreakdown = [d("2026-09-05", 3000), d("2026-09-06", 4000), d("2026-09-01", 700)];
    s.monthlyTrend = [t(2026, 8, 1000, 10000), t(2026, 9, 7700, 10000)];
    expect(buildExpenseInsights(s, new Date(2026, 9, 17)).length).toBeLessThanOrEqual(5);
  });

  it("names the months for a lower past month", () => {
    const s = past();
    s.monthlyTrend = [t(2026, 8, 10000, 10000), t(2026, 9, 7700, 10000)];
    const mom = buildExpenseInsights(s, new Date(2026, 9, 17)).find((i) => i.kind === "mom");
    expect(mom?.text).toBe("Spending in September was 23% lower than in August.");
    expect(mom?.tone).toBe("positive");
  });

  it("includes a month-over-month sentence on a big change", () => {
    const s = past();
    s.monthlyTrend = [t(2026, 8, 5000, 10000), t(2026, 9, 7700, 10000)];
    const mom = buildExpenseInsights(s, new Date(2026, 9, 17)).find((i) => i.kind === "mom");
    expect(mom?.text).toBe("Spending in September was 54% higher than in August.");
    expect(mom?.tone).toBe("warning");
  });
});
