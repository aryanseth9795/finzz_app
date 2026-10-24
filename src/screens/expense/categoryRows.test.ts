import { describe, it, expect } from "vitest";
import {
  buildCategoryRows,
  categoryFilterFor,
  donutSlices,
  isRowHighlighted,
  transactionCountLabel,
  visibleRowCount,
  CategoryRow,
} from "./categoryRows";

const cat = (name: string, total: number, count = 1) => ({
  name,
  total,
  count,
  percentage: 0,
});

const row = (name: string, total: number, share: number): CategoryRow => ({
  name,
  total,
  count: 1,
  share,
  trend: null,
});

describe("buildCategoryRows", () => {
  it("sorts by total, largest first, and keeps every category", () => {
    const rows = buildCategoryRows(
      [cat("Food", 100), cat("Rent", 500), cat("Gym", 50), cat("Cab", 250)],
      [],
    );
    expect(rows.map((r) => r.name)).toEqual(["Rent", "Cab", "Food", "Gym"]);
  });

  it("drops zero, negative and non-finite totals", () => {
    const rows = buildCategoryRows(
      [
        cat("Food", 100),
        cat("Zero", 0),
        cat("Neg", -20),
        cat("NaN", Number.NaN),
        cat("Inf", Number.POSITIVE_INFINITY),
      ],
      [],
    );
    expect(rows.map((r) => r.name)).toEqual(["Food"]);
  });

  it("computes the share of all categorised spending", () => {
    const rows = buildCategoryRows([cat("A", 300), cat("B", 100)], []);
    expect(rows[0].share).toBeCloseTo(75, 5);
    expect(rows[1].share).toBeCloseTo(25, 5);
  });

  it("keeps the transaction count and guards a missing one", () => {
    const rows = buildCategoryRows(
      [
        cat("A", 300, 4),
        { name: "B", total: 100, count: Number.NaN, percentage: 0 },
      ],
      [],
    );
    expect(rows[0].count).toBe(4);
    expect(rows[1].count).toBe(0);
  });

  it("attaches the trend by name and leaves null when missing", () => {
    const rows = buildCategoryRows(
      [cat("Food", 100), cat("Rent", 500)],
      [
        {
          name: "Rent",
          months: [
            { month: "2026-08", total: 480 },
            { month: "2026-09", total: 500 },
            { month: "2026-10", total: 500 },
          ],
        },
      ],
    );
    expect(rows[0].trend).toEqual([480, 500, 500]);
    expect(rows[1].trend).toBeNull();
  });

  it("matches a trend ignoring case and outer spaces", () => {
    const rows = buildCategoryRows(
      [cat("Food", 100)],
      [{ name: " food ", months: [{ month: "a", total: 1 }, { month: "b", total: 2 }] }],
    );
    expect(rows[0].trend).toEqual([1, 2]);
  });

  it("prefers the exact-name trend over a case variant", () => {
    const rows = buildCategoryRows(
      [cat("Food", 100)],
      [
        { name: "food", months: [{ month: "a", total: 9 }] },
        { name: "Food", months: [{ month: "a", total: 1 }] },
      ],
    );
    expect(rows[0].trend).toEqual([1]);
  });

  it("handles missing breakdown and trend", () => {
    expect(buildCategoryRows(undefined, undefined)).toEqual([]);
    expect(buildCategoryRows(null, null)).toEqual([]);
  });

  it("breaks total ties by name so the order is stable", () => {
    const rows = buildCategoryRows([cat("Zoo", 10), cat("Apple", 10)], []);
    expect(rows.map((r) => r.name)).toEqual(["Apple", "Zoo"]);
  });
});

describe("donutSlices", () => {
  it("keeps every category when there are 7 or fewer, all at least 1%", () => {
    const rows = buildCategoryRows(
      [cat("A", 40), cat("B", 30), cat("C", 20), cat("D", 10)],
      [],
    );
    const { slices, othersStart } = donutSlices(rows);
    expect(othersStart).toBeNull();
    expect(slices.map((s) => s.label)).toEqual(["A", "B", "C", "D"]);
    expect(slices.every((s) => !s.isOthers)).toBe(true);
  });

  it("folds everything after the top 7 into one Others slice", () => {
    const rows = buildCategoryRows(
      Array.from({ length: 12 }, (_, i) => cat(`C${i}`, 100 - i)),
      [],
    );
    const { slices, othersStart } = donutSlices(rows);
    expect(othersStart).toBe(7);
    expect(slices).toHaveLength(8);
    expect(slices.slice(0, 7).map((s) => s.label)).toEqual(
      rows.slice(0, 7).map((r) => r.name),
    );
    const others = slices[7];
    expect(others.isOthers).toBe(true);
    expect(others.label).toBe("Others (5)");
    expect(others.value).toBe(
      rows.slice(7).reduce((a, r) => a + r.total, 0),
    );
  });

  it("folds slices under 1% into Others even inside the top 7", () => {
    const rows = [
      row("A", 900, 90),
      row("B", 95, 9.5),
      row("C", 4, 0.4),
      row("D", 1, 0.1),
    ];
    const { slices, othersStart } = donutSlices(rows);
    expect(othersStart).toBe(2);
    expect(slices.map((s) => s.label)).toEqual(["A", "B", "Others (2)"]);
    expect(slices[2].value).toBe(5);
  });

  it("respects custom topN and minPct", () => {
    const rows = [row("A", 50, 50), row("B", 30, 30), row("C", 20, 20)];
    expect(donutSlices(rows, 2).othersStart).toBe(2);
    expect(donutSlices(rows, 7, 25).othersStart).toBe(2);
  });

  it("returns nothing for no rows", () => {
    expect(donutSlices([])).toEqual({ slices: [], othersStart: null });
  });
});

describe("visibleRowCount", () => {
  it("shows every row up to the limit", () => {
    expect(visibleRowCount(0, false)).toBe(0);
    expect(visibleRowCount(7, false)).toBe(7);
    expect(visibleRowCount(10, false)).toBe(10);
  });

  it("caps at the limit when collapsed", () => {
    expect(visibleRowCount(11, false)).toBe(10);
    expect(visibleRowCount(22, false)).toBe(10);
  });

  it("shows every row when expanded", () => {
    expect(visibleRowCount(22, true)).toBe(22);
    expect(visibleRowCount(4, true)).toBe(4);
  });

  it("takes a custom limit", () => {
    expect(visibleRowCount(8, false, 5)).toBe(5);
  });
});

describe("isRowHighlighted", () => {
  it("highlights nothing without a selection", () => {
    expect(isRowHighlighted(0, null, 7)).toBe(false);
  });

  it("highlights the one row of a top slice", () => {
    expect(isRowHighlighted(2, 2, 7)).toBe(true);
    expect(isRowHighlighted(3, 2, 7)).toBe(false);
  });

  it("highlights every row from the Others slice on", () => {
    expect(isRowHighlighted(6, 7, 7)).toBe(false);
    expect(isRowHighlighted(7, 7, 7)).toBe(true);
    expect(isRowHighlighted(15, 7, 7)).toBe(true);
  });

  it("treats the selection as a single row when there is no Others slice", () => {
    expect(isRowHighlighted(3, 3, null)).toBe(true);
    expect(isRowHighlighted(4, 3, null)).toBe(false);
  });
});

describe("transactionCountLabel", () => {
  it("uses the singular for one", () => {
    expect(transactionCountLabel(1)).toBe("1 transaction");
  });

  it("uses the plural otherwise", () => {
    expect(transactionCountLabel(0)).toBe("0 transactions");
    expect(transactionCountLabel(12)).toBe("12 transactions");
  });
});

describe("categoryFilterFor", () => {
  const month = { year: 2026, month: 10 };

  it("filters by the category name for that month, money out only", () => {
    expect(categoryFilterFor("Food", month)).toEqual({
      year: 2026,
      month: 10,
      category: "Food",
      type: "debit",
    });
  });

  it("asks for uncategorized rows and rows named Other for the Other category", () => {
    expect(categoryFilterFor("Other", month)).toEqual({
      year: 2026,
      month: 10,
      category: "Other",
      uncategorized: true,
      type: "debit",
    });
  });

  it("treats Other case-insensitively", () => {
    expect(categoryFilterFor(" other ", month)).toEqual({
      year: 2026,
      month: 10,
      category: "Other",
      uncategorized: true,
      type: "debit",
    });
  });

  it("does not treat names that only contain Other as uncategorized", () => {
    expect(categoryFilterFor("Other bills", month)).toEqual({
      year: 2026,
      month: 10,
      category: "Other bills",
      type: "debit",
    });
  });

  it("always limits the list to debits, as the report counts only money out", () => {
    for (const name of ["Food", "Other", "Salary", " other "]) {
      expect(categoryFilterFor(name, month).type).toBe("debit");
    }
  });
});
