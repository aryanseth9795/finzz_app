import { describe, expect, it } from "vitest";
import type { IExpense, IExpenseLedger } from "../types";
import { EMPTY_EXPENSE_FILTERS } from "../constants/expenseFilters";
import {
  EMPTY_SEARCH_SUMMARY,
  SEARCH_DEBOUNCE_MS,
  filtersFromReport,
  findLedger,
  isExpenseEditable,
  ledgerMonthName,
  mergeResults,
  readSearchPage,
  searchDelay,
} from "./expenseSearchState";

const expense = (id: string, over: Partial<IExpense> = {}): IExpense => ({
  _id: id,
  userId: "u1",
  ledgerId: "l-oct",
  amount: 100,
  type: "debit",
  date: "2026-10-20T00:00:00.000Z",
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  ...over,
});

const ledger = (
  id: string,
  year: number,
  month: number,
  status: IExpenseLedger["status"] = "open",
): IExpenseLedger => ({
  _id: id,
  userId: "u1",
  year,
  month,
  status,
  totalExpenses: 0,
  totalCredits: 0,
});

const LEDGERS = [
  ledger("l-oct", 2026, 10),
  ledger("l-sep", 2026, 9, "closed"),
  ledger("l-oct25", 2025, 10, "closed"),
];

describe("mergeResults", () => {
  it("appends the next page after the loaded rows", () => {
    const merged = mergeResults([expense("a"), expense("b")], [expense("c"), expense("d")]);
    expect(merged.map((e) => e._id)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops rows of the next page that are already loaded", () => {
    const merged = mergeResults(
      [expense("a"), expense("b")],
      [expense("b", { amount: 999 }), expense("c")],
    );
    expect(merged.map((e) => e._id)).toEqual(["a", "b", "c"]);
    // The row already on screen keeps its place and data.
    expect(merged[1].amount).toBe(100);
  });

  it("drops duplicates inside the incoming page too", () => {
    const merged = mergeResults([], [expense("a"), expense("a"), expense("b")]);
    expect(merged.map((e) => e._id)).toEqual(["a", "b"]);
  });

  it("returns the loaded rows unchanged for an empty page", () => {
    const loaded = [expense("a")];
    expect(mergeResults(loaded, [])).toEqual(loaded);
  });
});

describe("readSearchPage", () => {
  it("reads a full reply", () => {
    const page = readSearchPage({
      success: true,
      expenses: [expense("a")],
      nextCursor: "cur",
      hasMore: true,
      summary: { count: 12, debitTotal: 3450, creditTotal: 200 },
    });
    expect(page.expenses.map((e) => e._id)).toEqual(["a"]);
    expect(page.nextCursor).toBe("cur");
    expect(page.hasMore).toBe(true);
    expect(page.summary).toEqual({ count: 12, debitTotal: 3450, creditTotal: 200 });
  });

  it("never claims more pages without a cursor", () => {
    const page = readSearchPage({ expenses: [], nextCursor: null, hasMore: true });
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("has no summary when the reply has none (later pages)", () => {
    expect(readSearchPage({ expenses: [], hasMore: false }).summary).toBeNull();
  });

  it("ignores a summary with missing or non-numeric fields", () => {
    expect(
      readSearchPage({ expenses: [], summary: { count: "3", debitTotal: 1, creditTotal: 0 } })
        .summary,
    ).toBeNull();
    expect(readSearchPage({ expenses: [], summary: { count: 3 } }).summary).toBeNull();
  });

  it("treats a malformed reply as an empty last page", () => {
    for (const raw of [undefined, null, "oops", { expenses: "nope" }]) {
      const page = readSearchPage(raw);
      expect(page.expenses).toEqual([]);
      expect(page.hasMore).toBe(false);
      expect(page.summary).toBeNull();
    }
  });
});

describe("searchDelay", () => {
  it("waits for a pause when only the search text changed", () => {
    expect(searchDelay({ ledgerId: "l1" }, { ledgerId: "l1", q: "p" })).toBe(SEARCH_DEBOUNCE_MS);
    expect(searchDelay({ q: "p", type: "debit" }, { q: "pi", type: "debit" })).toBe(
      SEARCH_DEBOUNCE_MS,
    );
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it("runs at once when anything else changed", () => {
    expect(searchDelay({ q: "p" }, { q: "p", type: "credit" })).toBe(0);
    expect(searchDelay({ q: "p" }, { q: "pi", type: "credit" })).toBe(0);
    expect(searchDelay({ category: ["Food"] }, { category: ["Food", "Gym"] })).toBe(0);
    expect(searchDelay({ ledgerId: "l1", q: "p" }, { q: "p" })).toBe(0);
    expect(searchDelay({ ledgerId: "l1" }, { ledgerId: "l2" })).toBe(0);
  });

  it("runs at once with no earlier search", () => {
    expect(searchDelay(null, { q: "p" })).toBe(0);
  });

  it("compares category lists by value, not identity", () => {
    expect(searchDelay({ category: ["Food"] }, { category: ["Food"], q: "x" })).toBe(
      SEARCH_DEBOUNCE_MS,
    );
  });
});

describe("findLedger", () => {
  it("finds the ledger of a year and month", () => {
    expect(findLedger(LEDGERS, 2026, 9)?._id).toBe("l-sep");
    expect(findLedger(LEDGERS, 2025, 10)?._id).toBe("l-oct25");
  });

  it("is null when that month has no ledger", () => {
    expect(findLedger(LEDGERS, 2026, 8)).toBeNull();
    expect(findLedger([], 2026, 10)).toBeNull();
  });
});

describe("filtersFromReport", () => {
  it("opens one category of that month", () => {
    const { ledger: picked, filters } = filtersFromReport(
      { year: 2026, month: 9, category: "Food" },
      LEDGERS,
    );
    expect(picked?._id).toBe("l-sep");
    expect(filters).toEqual({
      ...EMPTY_EXPENSE_FILTERS,
      categories: ["Food"],
      uncategorized: false,
      scope: "month",
    });
  });

  it('maps "Other" to the category "Other" plus no category', () => {
    const { filters } = filtersFromReport(
      { year: 2026, month: 10, category: "Other", uncategorized: true },
      LEDGERS,
    );
    expect(filters.categories).toEqual(["Other"]);
    expect(filters.uncategorized).toBe(true);
    expect(filters.scope).toBe("month");
  });

  it("filters on no category alone when no name is given", () => {
    const { filters } = filtersFromReport({ year: 2026, month: 10, uncategorized: true }, LEDGERS);
    expect(filters.categories).toEqual([]);
    expect(filters.uncategorized).toBe(true);
  });

  it("ignores a blank category name", () => {
    const { filters } = filtersFromReport({ year: 2026, month: 10, category: "   " }, LEDGERS);
    expect(filters.categories).toEqual([]);
  });

  it("searches all months when that month has no ledger", () => {
    const { ledger: picked, filters } = filtersFromReport(
      { year: 2024, month: 1, category: "Rent" },
      LEDGERS,
    );
    expect(picked).toBeNull();
    expect(filters.scope).toBe("all");
    expect(filters.categories).toEqual(["Rent"]);
  });

  it("starts from no search text and no other filters", () => {
    const { filters } = filtersFromReport({ year: 2026, month: 10, category: "Food" }, LEDGERS);
    expect(filters.q).toBe("");
    expect(filters.type).toBe("all");
    expect(filters.minAmount).toBe("");
    expect(filters.maxAmount).toBe("");
  });

  it("keeps the report's money-out type so the list matches its numbers", () => {
    const { filters } = filtersFromReport(
      { year: 2026, month: 9, category: "Food", type: "debit" },
      LEDGERS,
    );
    expect(filters).toEqual({
      ...EMPTY_EXPENSE_FILTERS,
      categories: ["Food"],
      uncategorized: false,
      type: "debit",
      scope: "month",
    });
  });

  it('limits "Other" to debits, so uncategorized credits stay out', () => {
    const { filters } = filtersFromReport(
      { year: 2026, month: 10, category: "Other", uncategorized: true, type: "debit" },
      LEDGERS,
    );
    expect(filters.categories).toEqual(["Other"]);
    expect(filters.uncategorized).toBe(true);
    expect(filters.type).toBe("debit");
  });

  it("passes a credit type through", () => {
    const { filters } = filtersFromReport(
      { year: 2026, month: 10, category: "Salary", type: "credit" },
      LEDGERS,
    );
    expect(filters.type).toBe("credit");
  });

  it('defaults the type to "all" when the param has none', () => {
    const { filters } = filtersFromReport({ year: 2026, month: 10, category: "Food" }, LEDGERS);
    expect(filters.type).toBe("all");
  });

  it('treats an unknown type value as "all"', () => {
    const { filters } = filtersFromReport(
      { year: 2026, month: 10, category: "Food", type: "bogus" as unknown as "debit" },
      LEDGERS,
    );
    expect(filters.type).toBe("all");
  });
});

describe("ledgerMonthName", () => {
  it("shows the month with the full year", () => {
    expect(ledgerMonthName({ year: 2026, month: 10 })).toBe("Oct 2026");
    expect(ledgerMonthName({ year: 2025, month: 1 })).toBe("Jan 2025");
    expect(ledgerMonthName({ year: 2025, month: 12 })).toBe("Dec 2025");
  });

  it('is "This month" with no ledger', () => {
    expect(ledgerMonthName(null)).toBe("This month");
    expect(ledgerMonthName(undefined)).toBe("This month");
  });
});

describe("isExpenseEditable", () => {
  it("allows rows of an open month", () => {
    expect(isExpenseEditable(expense("a", { ledgerId: "l-oct" }), LEDGERS)).toBe(true);
  });

  it("keeps rows of a closed month read-only", () => {
    expect(isExpenseEditable(expense("a", { ledgerId: "l-sep" }), LEDGERS)).toBe(false);
  });

  it("leaves a row of an unknown month to the server", () => {
    expect(isExpenseEditable(expense("a", { ledgerId: "l-missing" }), LEDGERS)).toBe(true);
  });
});

describe("EMPTY_SEARCH_SUMMARY", () => {
  it("is zero matches", () => {
    expect(EMPTY_SEARCH_SUMMARY).toEqual({ count: 0, debitTotal: 0, creditTotal: 0 });
  });
});
