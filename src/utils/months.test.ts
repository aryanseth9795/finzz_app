import { describe, expect, it } from "vitest";
import type { IAvailableMonth } from "../types";
import {
  MONTH_LONG,
  MONTH_SHORT,
  addMonths,
  currentYearMonth,
  firstOfMonthApiDate,
  isSameMonth,
  isStatsForMonth,
  mergeWindowCounts,
  monthKey,
  monthLabel,
  monthsEndingAt,
  sortMonthsDesc,
  stepMonth,
  withCurrentMonth,
  yearGrid,
} from "./months";

const m = (year: number, month: number, txCount = 1): IAvailableMonth => ({
  year,
  month,
  txCount,
});

describe("names and keys", () => {
  it("has twelve short and long names", () => {
    expect(MONTH_SHORT).toHaveLength(12);
    expect(MONTH_SHORT[0]).toBe("Jan");
    expect(MONTH_SHORT[11]).toBe("Dec");
    expect(MONTH_LONG).toHaveLength(12);
    expect(MONTH_LONG[9]).toBe("October");
  });

  it("zero-pads the month in monthKey", () => {
    expect(monthKey({ year: 2026, month: 3 })).toBe("2026-03");
    expect(monthKey({ year: 2026, month: 10 })).toBe("2026-10");
  });

  it("labels long and short", () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe("October 2026");
    expect(monthLabel({ year: 2026, month: 10 }, "short")).toBe("Oct 2026");
  });

  it("compares months", () => {
    expect(isSameMonth({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(true);
    expect(isSameMonth({ year: 2026, month: 3 }, { year: 2025, month: 3 })).toBe(false);
    expect(isSameMonth({ year: 2026, month: 3 }, { year: 2026, month: 4 })).toBe(false);
  });

  it("reads the local calendar month", () => {
    expect(currentYearMonth(new Date(2026, 9, 17, 12))).toEqual({ year: 2026, month: 10 });
    expect(currentYearMonth(new Date(2027, 0, 1, 0, 0))).toEqual({ year: 2027, month: 1 });
  });
});

describe("sortMonthsDesc", () => {
  it("orders newest first without mutating the input", () => {
    const input = [m(2026, 3), m(2025, 12), m(2026, 10)];
    const copy = [...input];
    expect(sortMonthsDesc(input)).toEqual([m(2026, 10), m(2026, 3), m(2025, 12)]);
    expect(input).toEqual(copy);
  });
});

describe("withCurrentMonth", () => {
  it("adds the current month when missing", () => {
    const out = withCurrentMonth([m(2026, 7), m(2026, 3)], new Date(2026, 9, 17));
    expect(out).toEqual([m(2026, 10, 0), m(2026, 7), m(2026, 3)]);
  });

  it("does not duplicate or overwrite the current month", () => {
    const out = withCurrentMonth([m(2026, 10, 5), m(2026, 7)], new Date(2026, 9, 17));
    expect(out).toEqual([m(2026, 10, 5), m(2026, 7)]);
  });

  it("handles a December to January rollover", () => {
    const out = withCurrentMonth([m(2026, 12), m(2026, 11)], new Date(2027, 0, 3));
    expect(out).toEqual([m(2027, 1, 0), m(2026, 12), m(2026, 11)]);
  });

  it("returns just the current month for an empty list", () => {
    expect(withCurrentMonth([], new Date(2026, 9, 17))).toEqual([m(2026, 10, 0)]);
  });
});

describe("stepMonth", () => {
  const list = [m(2026, 10), m(2026, 7), m(2026, 3)];

  it("steps to the previous and next available month, skipping gaps", () => {
    expect(stepMonth(list, { year: 2026, month: 7 }, -1)).toEqual(m(2026, 3));
    expect(stepMonth(list, { year: 2026, month: 7 }, 1)).toEqual(m(2026, 10));
  });

  it("returns null at both ends", () => {
    expect(stepMonth(list, { year: 2026, month: 3 }, -1)).toBeNull();
    expect(stepMonth(list, { year: 2026, month: 10 }, 1)).toBeNull();
  });

  it("picks the nearest in that direction when selected is not listed", () => {
    expect(stepMonth(list, { year: 2026, month: 8 }, -1)).toEqual(m(2026, 7));
    expect(stepMonth(list, { year: 2026, month: 8 }, 1)).toEqual(m(2026, 10));
    expect(stepMonth(list, { year: 2026, month: 1 }, -1)).toBeNull();
    expect(stepMonth(list, { year: 2027, month: 1 }, 1)).toBeNull();
  });

  it("does not depend on input order", () => {
    const shuffled = [m(2026, 3), m(2026, 10), m(2026, 7)];
    expect(stepMonth(shuffled, { year: 2026, month: 7 }, 1)).toEqual(m(2026, 10));
  });
});

describe("yearGrid", () => {
  const now = new Date(2026, 9, 17);

  it("gives twelve cells per year, newest year first", () => {
    const grid = yearGrid([m(2025, 12, 4), m(2026, 3, 2)], now);
    expect(grid.map((g) => g.year)).toEqual([2026, 2025]);
    for (const g of grid) {
      expect(g.cells).toHaveLength(12);
      expect(g.cells.map((c) => c.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  });

  it("disables empty months and reports counts", () => {
    const [y2026, y2025] = yearGrid([m(2025, 12, 4), m(2026, 3, 2)], now);
    expect(y2026.cells[2]).toEqual({ month: 3, count: 2, enabled: true, isCurrent: false });
    expect(y2026.cells[3]).toEqual({ month: 4, count: 0, enabled: false, isCurrent: false });
    expect(y2025.cells[11]).toEqual({ month: 12, count: 4, enabled: true, isCurrent: false });
    expect(y2025.cells[0].enabled).toBe(false);
  });

  it("always enables the current month, with count 0 if absent", () => {
    const [y2026] = yearGrid([m(2026, 3, 2)], now);
    expect(y2026.cells[9]).toEqual({ month: 10, count: 0, enabled: true, isCurrent: true });
  });

  it("includes the current year even with no available months", () => {
    const grid = yearGrid([], now);
    expect(grid).toHaveLength(1);
    expect(grid[0].year).toBe(2026);
  });

  it("treats a zero-count listed month as disabled", () => {
    const [y2026] = yearGrid([m(2026, 5, 0)], now);
    expect(y2026.cells[4].enabled).toBe(false);
  });

  it("keeps the default rule when options are empty or enableAllMonths is false", () => {
    const list = [m(2026, 5, 0), m(2026, 3, 2)];
    const base = yearGrid(list, now);
    expect(yearGrid(list, now, {})).toEqual(base);
    expect(yearGrid(list, now, { enableAllMonths: false })).toEqual(base);
    expect(base[0].cells[4].enabled).toBe(false);
  });

  describe("enableAllMonths", () => {
    // An 18-month list where only the newest months have known counts.
    const list = [
      m(2026, 10, 3),
      m(2026, 9, 0),
      m(2026, 8, 5),
      m(2025, 6, 0),
      m(2025, 5, 0),
    ];

    it("enables every listed month, even with a zero count", () => {
      const [y2026, y2025] = yearGrid(list, now, { enableAllMonths: true });
      expect(y2026.cells[8]).toEqual({ month: 9, count: 0, enabled: true, isCurrent: false });
      expect(y2025.cells[4]).toEqual({ month: 5, count: 0, enabled: true, isCurrent: false });
      expect(y2025.cells[5].enabled).toBe(true);
    });

    it("still reports counts for the badges", () => {
      const [y2026] = yearGrid(list, now, { enableAllMonths: true });
      expect(y2026.cells[7]).toEqual({ month: 8, count: 5, enabled: true, isCurrent: false });
      expect(y2026.cells[9]).toEqual({ month: 10, count: 3, enabled: true, isCurrent: true });
    });

    it("leaves unlisted months disabled", () => {
      const [y2026, y2025] = yearGrid(list, now, { enableAllMonths: true });
      expect(y2026.cells[10].enabled).toBe(false); // Nov 2026, future
      expect(y2026.cells[0].enabled).toBe(false); // Jan 2026, not listed
      expect(y2025.cells[3].enabled).toBe(false); // Apr 2025, before the list
    });

    it("still enables the current month when it is not listed", () => {
      const [y2026] = yearGrid([m(2026, 3, 0)], now, { enableAllMonths: true });
      expect(y2026.cells[9]).toEqual({ month: 10, count: 0, enabled: true, isCurrent: true });
      expect(y2026.cells[2].enabled).toBe(true);
    });
  });
});

describe("addMonths", () => {
  it("moves within a year", () => {
    expect(addMonths({ year: 2026, month: 10 }, -3)).toEqual({ year: 2026, month: 7 });
    expect(addMonths({ year: 2026, month: 3 }, 2)).toEqual({ year: 2026, month: 5 });
    expect(addMonths({ year: 2026, month: 3 }, 0)).toEqual({ year: 2026, month: 3 });
  });

  it("crosses year boundaries both ways", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 10 }, -12)).toEqual({ year: 2025, month: 10 });
    expect(addMonths({ year: 2026, month: 10 }, -22)).toEqual({ year: 2024, month: 12 });
  });
});

describe("monthsEndingAt", () => {
  it("lists `count` months newest first, including the end month", () => {
    expect(monthsEndingAt({ year: 2026, month: 2 }, 4)).toEqual([
      { year: 2026, month: 2 },
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
      { year: 2025, month: 11 },
    ]);
  });

  it("gives 18 distinct months for the Analytics selector", () => {
    const list = monthsEndingAt({ year: 2026, month: 10 }, 18);
    expect(list).toHaveLength(18);
    expect(list[17]).toEqual({ year: 2025, month: 5 });
    expect(new Set(list.map(monthKey)).size).toBe(18);
  });

  it("is empty for zero, negative or non-finite counts", () => {
    expect(monthsEndingAt({ year: 2026, month: 10 }, 0)).toEqual([]);
    expect(monthsEndingAt({ year: 2026, month: 10 }, -2)).toEqual([]);
    expect(monthsEndingAt({ year: 2026, month: 10 }, Number.NaN)).toEqual([]);
  });
});

describe("mergeWindowCounts", () => {
  const end = { year: 2026, month: 10 };

  it("zeroes window months missing from the reply (all rows deleted)", () => {
    const prev = { "2026-10": 4, "2026-08": 3 };
    const out = mergeWindowCounts(prev, end, 13, { "2026-10": 4 });
    expect(out["2026-08"]).toBe(0);
    expect(out["2026-10"]).toBe(4);
  });

  it("covers exactly `span` months ending at `end`", () => {
    const out = mergeWindowCounts({}, end, 13, {});
    expect(Object.keys(out).sort()).toEqual(
      monthsEndingAt(end, 13).map(monthKey).sort(),
    );
    expect(out["2025-10"]).toBe(0);
    expect(out["2025-09"]).toBeUndefined();
  });

  it("keeps counts outside the window", () => {
    const prev = { "2025-09": 7, "2025-05": 2, "2026-11": 1 };
    const out = mergeWindowCounts(prev, end, 13, {});
    expect(out["2025-09"]).toBe(7);
    expect(out["2025-05"]).toBe(2);
    expect(out["2026-11"]).toBe(1);
  });

  it("applies the reply's counts over the reset window", () => {
    const out = mergeWindowCounts({ "2026-03": 9 }, end, 13, {
      "2026-03": 2,
      "2026-09": 5,
    });
    expect(out["2026-03"]).toBe(2);
    expect(out["2026-09"]).toBe(5);
  });

  it("does not mutate the previous counts", () => {
    const prev = { "2026-08": 3 };
    mergeWindowCounts(prev, end, 13, {});
    expect(prev).toEqual({ "2026-08": 3 });
  });
});

describe("firstOfMonthApiDate", () => {
  it("is UTC midnight on the 1st", () => {
    expect(firstOfMonthApiDate({ year: 2026, month: 10 })).toBe("2026-10-01T00:00:00.000Z");
    expect(firstOfMonthApiDate({ year: 2027, month: 1 })).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("isStatsForMonth", () => {
  const stats = { year: 2026, month: 9 };

  it("is true only when the stats' year and month match", () => {
    expect(isStatsForMonth(stats, { year: 2026, month: 9 })).toBe(true);
    expect(isStatsForMonth(stats, { year: 2026, month: 10 })).toBe(false);
    expect(isStatsForMonth(stats, { year: 2025, month: 9 })).toBe(false);
  });

  it("is false when there are no stats", () => {
    expect(isStatsForMonth(null, { year: 2026, month: 9 })).toBe(false);
    expect(isStatsForMonth(undefined, { year: 2026, month: 9 })).toBe(false);
  });
});
