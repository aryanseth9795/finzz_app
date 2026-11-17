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
  insertByDate,
} from "./expenseList";
import type { IExpense } from "../types";

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

  it("adds the payment method after the category", () => {
    expect(
      rowText({
        remarks: "Pizza",
        category: "Food",
        type: "debit",
        paymentMode: "online",
        paymentMethod: "upi",
      }),
    ).toEqual({ title: "Pizza", subtitle: "Food · UPI" });
  });

  it("shows the mode alone under a remark with no category", () => {
    expect(rowText({ remarks: "Auto", type: "debit", paymentMode: "cash" })).toEqual({
      title: "Auto",
      subtitle: "Cash",
    });
  });

  it("shows the payment under a category title", () => {
    expect(rowText({ category: "Food", type: "debit", paymentMode: "cash" })).toEqual({
      title: "Food",
      subtitle: "Cash",
    });
  });

  it("shows the payment under the fallback title", () => {
    expect(
      rowText({ type: "debit", paymentMode: "online", paymentMethod: "card" }),
    ).toEqual({ title: "Expense", subtitle: "Card" });
  });

  it("shows the method on money in", () => {
    expect(
      rowText({
        category: "Salary",
        type: "credit",
        paymentMode: "online",
        paymentMethod: "netbanking",
      }),
    ).toEqual({ title: "Salary", subtitle: "Net banking" });
  });

  it("falls back to the mode for an unknown method", () => {
    expect(
      rowText({
        type: "debit",
        paymentMode: "online",
        paymentMethod: "crypto" as never,
      }),
    ).toEqual({ title: "Expense", subtitle: "Online" });
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

describe("insertByDate", () => {
  // The server lists rows by date (newest first), then by _id (newest first).
  const row = (id: string, day: string, extra: Partial<IExpense> = {}): IExpense => ({
    _id: id,
    userId: "u1",
    ledgerId: "oct",
    amount: 100,
    type: "debit",
    date: at(day),
    createdAt: at(day),
    updatedAt: at(day),
    ...extra,
  });

  const ids = (list: IExpense[]) => list.map((e) => e._id);

  // 31 / 20 / 12 Oct, as the server sends them.
  const october = [
    row("a31", "2026-10-31"),
    row("a20", "2026-10-20"),
    row("a12", "2026-10-12"),
  ];

  it("goes first when it is the newest", () => {
    const next = insertByDate(october, row("b", "2026-11-01"), true);
    expect(ids(next)).toEqual(["b", "a31", "a20", "a12"]);
  });

  it("goes in the middle by date", () => {
    const next = insertByDate(october, row("b", "2026-10-15"), true);
    expect(ids(next)).toEqual(["a31", "a20", "b", "a12"]);
  });

  it("orders rows on the same date by _id, newest first", () => {
    const newer = insertByDate(october, row("b12", "2026-10-12"), true);
    expect(ids(newer)).toEqual(["a31", "a20", "b12", "a12"]);
    const older = insertByDate(october, row("a00", "2026-10-20"), true);
    expect(ids(older)).toEqual(["a31", "a20", "a00", "a12"]);
  });

  it("goes last when every row is loaded", () => {
    const next = insertByDate(october, row("b", "2026-10-01"), false);
    expect(ids(next)).toEqual(["a31", "a20", "a12", "b"]);
  });

  it("is left out when it would be last and more pages are to come", () => {
    const next = insertByDate(october, row("b", "2026-10-01"), true);
    expect(ids(next)).toEqual(["a31", "a20", "a12"]);
  });

  it("replaces the row with the same _id, moving it to its new place", () => {
    const edited = row("a31", "2026-10-15", { amount: 7 });
    const next = insertByDate(october, edited, true);
    expect(ids(next)).toEqual(["a20", "a31", "a12"]);
    expect(next[1]).toBe(edited);
  });

  it("keeps the last row when it is edited without moving, though more pages are to come", () => {
    const edited = row("a12", "2026-10-12", { amount: 7 });
    const next = insertByDate(october, edited, true);
    expect(ids(next)).toEqual(["a31", "a20", "a12"]);
    expect(next[2]).toBe(edited);
  });

  it("drops the last row when its new date moves it past the loaded rows", () => {
    // The paging cursor still holds its old date, so the next page brings it.
    const next = insertByDate(october, row("a12", "2026-10-02"), true);
    expect(ids(next)).toEqual(["a31", "a20"]);
  });

  it("puts the row in an empty list", () => {
    expect(ids(insertByDate([], row("b", "2026-10-12"), true))).toEqual(["b"]);
    expect(ids(insertByDate([], row("b", "2026-10-12"), false))).toEqual(["b"]);
  });

  it("returns a new array and leaves the input alone", () => {
    const list = [...october];
    const next = insertByDate(list, row("b", "2026-10-15"), true);
    expect(next).not.toBe(list);
    expect(ids(list)).toEqual(["a31", "a20", "a12"]);
  });
});
