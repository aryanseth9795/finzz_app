import { describe, it, expect } from "vitest";
import {
  dayKeyOf,
  dayLabel,
  dayTotals,
  startsNewDay,
  displayCategory,
  rowText,
  categoryColorIndex,
  categoryInitial,
} from "./expenseList";

// Expenses are stored at UTC midnight of their calendar day.
const at = (day: string) => `${day}T00:00:00.000Z`;

describe("dayKeyOf", () => {
  it("reads the stored calendar day", () => {
    expect(dayKeyOf({ date: at("2026-10-23") })).toBe("2026-10-23");
  });
});

describe("dayLabel", () => {
  it("names today and yesterday", () => {
    expect(dayLabel("2026-10-24", "2026-10-24")).toBe("Today");
    expect(dayLabel("2026-10-23", "2026-10-24")).toBe("Yesterday");
  });

  it("uses weekday, day and month otherwise", () => {
    expect(dayLabel("2026-10-22", "2026-10-24")).toBe("Thu, 22 Oct");
  });

  it("adds the year for another year", () => {
    expect(dayLabel("2025-12-31", "2026-01-02")).toBe("Wed, 31 Dec 2025");
  });

  it("treats 1 Jan as yesterday from 2 Jan across a year boundary", () => {
    expect(dayLabel("2026-01-01", "2026-01-02")).toBe("Yesterday");
  });
});

describe("dayTotals", () => {
  it("sums debits and credits per day", () => {
    const totals = dayTotals([
      { date: at("2026-10-23"), amount: 79, type: "debit" },
      { date: at("2026-10-23"), amount: 589, type: "debit" },
      { date: at("2026-10-23"), amount: 500, type: "credit" },
      { date: at("2026-10-22"), amount: 170, type: "debit" },
    ]);
    expect(totals["2026-10-23"]).toEqual({ debit: 668, credit: 500 });
    expect(totals["2026-10-22"]).toEqual({ debit: 170, credit: 0 });
  });

  it("counts a row with no type as a debit", () => {
    const totals = dayTotals([
      { date: at("2026-10-23"), amount: 10, type: undefined as never },
    ]);
    expect(totals["2026-10-23"]).toEqual({ debit: 10, credit: 0 });
  });
});

describe("startsNewDay", () => {
  const rows = [
    { date: at("2026-10-23") },
    { date: at("2026-10-23") },
    { date: at("2026-10-22") },
  ];

  it("is true for the first row and at each day change", () => {
    expect(startsNewDay(rows, 0)).toBe(true);
    expect(startsNewDay(rows, 1)).toBe(false);
    expect(startsNewDay(rows, 2)).toBe(true);
  });
});

describe("displayCategory", () => {
  it("normalises a real category", () => {
    expect(displayCategory("  Food   court ")).toBe("Food court");
  });

  it("hides blank, the old '-' and non-strings", () => {
    expect(displayCategory("")).toBeNull();
    expect(displayCategory("-")).toBeNull();
    expect(displayCategory(undefined)).toBeNull();
  });
});

describe("rowText", () => {
  it("uses the remark as the title, with the category under it", () => {
    expect(rowText({ remarks: "Pizza", category: "Food", type: "debit" })).toEqual({
      title: "Pizza",
      subtitle: "Food",
    });
  });

  it("uses the category alone when there's no remark", () => {
    expect(rowText({ remarks: "  ", category: "Food", type: "debit" })).toEqual({
      title: "Food",
      subtitle: null,
    });
  });

  it("falls back by type when there's neither", () => {
    expect(rowText({ category: "-", type: "debit" })).toEqual({
      title: "Expense",
      subtitle: null,
    });
    expect(rowText({ type: "credit" })).toEqual({ title: "Money in", subtitle: null });
  });

  it("keeps a remark with no category on its own", () => {
    expect(rowText({ remarks: "Shanwaz cash", type: "debit" })).toEqual({
      title: "Shanwaz cash",
      subtitle: null,
    });
  });
});

describe("categoryColorIndex", () => {
  it("is the same for any case or spacing of a name", () => {
    expect(categoryColorIndex("Food", 8)).toBe(categoryColorIndex("  FOOD ", 8));
  });

  it("stays inside the palette", () => {
    for (const name of ["Food", "Recharge", "Medicine", "Gym", "EMI", "Claude", "a"]) {
      const i = categoryColorIndex(name, 8);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(8);
    }
  });
});

describe("categoryInitial", () => {
  it("is the first character, uppercased", () => {
    expect(categoryInitial("  food")).toBe("F");
    expect(categoryInitial("emi")).toBe("E");
  });
});
