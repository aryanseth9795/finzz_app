import { describe, expect, it } from "vitest";
import type { ExpenseFilters } from "../types";
import { EMPTY_EXPENSE_FILTERS } from "../constants/expenseFilters";
import {
  activeChips,
  activeFilterCount,
  amountRangeError,
  isFiltering,
  parseAmountInput,
  removeChip,
  toggleCategory,
  toSearchParams,
  totalsLabel,
} from "./expenseFilters";

const f = (over: Partial<ExpenseFilters> = {}): ExpenseFilters => ({
  ...EMPTY_EXPENSE_FILTERS,
  ...over,
});

describe("parseAmountInput", () => {
  it("is undefined for empty or blank text", () => {
    expect(parseAmountInput("")).toBeUndefined();
    expect(parseAmountInput("   ")).toBeUndefined();
  });

  it("reads plain and decimal amounts", () => {
    expect(parseAmountInput("250")).toBe(250);
    expect(parseAmountInput("250.5")).toBe(250.5);
    expect(parseAmountInput(" 99.99 ")).toBe(99.99);
    expect(parseAmountInput("0")).toBe(0);
  });

  it("accepts thousands separators, Western and Indian", () => {
    expect(parseAmountInput("1,200.50")).toBe(1200.5);
    expect(parseAmountInput("1,20,000")).toBe(120000);
  });

  it("rounds to paise", () => {
    expect(parseAmountInput("10.555")).toBe(10.56);
  });

  it("is undefined for junk", () => {
    expect(parseAmountInput("abc")).toBeUndefined();
    expect(parseAmountInput("12abc")).toBeUndefined();
    expect(parseAmountInput("1.2.3")).toBeUndefined();
    expect(parseAmountInput(".")).toBeUndefined();
    expect(parseAmountInput(",")).toBeUndefined();
    expect(parseAmountInput("1e5")).toBeUndefined();
    expect(parseAmountInput("Infinity")).toBeUndefined();
    expect(parseAmountInput("₹100")).toBeUndefined();
  });

  it("is undefined for negative amounts", () => {
    expect(parseAmountInput("-5")).toBeUndefined();
    expect(parseAmountInput("-0.5")).toBeUndefined();
  });

  it("is undefined for a missing value", () => {
    expect(parseAmountInput(undefined as unknown as string)).toBeUndefined();
  });
});

describe("amountRangeError", () => {
  it("flags max below min", () => {
    expect(amountRangeError(f({ minAmount: "500", maxAmount: "100" }))).toBe(
      "Max must be at least min"
    );
    expect(amountRangeError(f({ minAmount: "1,200", maxAmount: "1,199.99" }))).toBe(
      "Max must be at least min"
    );
  });

  it("allows max equal to or above min", () => {
    expect(amountRangeError(f({ minAmount: "100", maxAmount: "100" }))).toBeNull();
    expect(amountRangeError(f({ minAmount: "100", maxAmount: "500" }))).toBeNull();
  });

  it("is null unless both sides parse", () => {
    expect(amountRangeError(f())).toBeNull();
    expect(amountRangeError(f({ minAmount: "500" }))).toBeNull();
    expect(amountRangeError(f({ maxAmount: "100" }))).toBeNull();
    expect(amountRangeError(f({ minAmount: "500", maxAmount: "abc" }))).toBeNull();
  });
});

describe("isFiltering", () => {
  it("is false for the empty filters", () => {
    expect(isFiltering(EMPTY_EXPENSE_FILTERS)).toBe(false);
  });

  it("ignores blank or whitespace search text", () => {
    expect(isFiltering(f({ q: "   " }))).toBe(false);
    expect(isFiltering(f({ q: "piz" }))).toBe(true);
  });

  it("is true for each sheet filter", () => {
    expect(isFiltering(f({ type: "debit" }))).toBe(true);
    expect(isFiltering(f({ type: "credit" }))).toBe(true);
    expect(isFiltering(f({ categories: ["Food"] }))).toBe(true);
    expect(isFiltering(f({ uncategorized: true }))).toBe(true);
    expect(isFiltering(f({ minAmount: "100" }))).toBe(true);
    expect(isFiltering(f({ maxAmount: "500" }))).toBe(true);
    expect(isFiltering(f({ scope: "all" }))).toBe(true);
  });

  it("ignores amounts that don't parse and blank categories", () => {
    expect(isFiltering(f({ minAmount: "abc", maxAmount: "-5" }))).toBe(false);
    expect(isFiltering(f({ categories: ["  "] }))).toBe(false);
  });
});

describe("activeFilterCount", () => {
  it("is 0 for the empty filters", () => {
    expect(activeFilterCount(EMPTY_EXPENSE_FILTERS)).toBe(0);
  });

  it("does not count the search text", () => {
    expect(activeFilterCount(f({ q: "pizza" }))).toBe(0);
  });

  it("counts type, each category, uncategorized, the amount range once and all months", () => {
    expect(
      activeFilterCount(
        f({
          type: "debit",
          categories: ["Food", "Rent"],
          uncategorized: true,
          minAmount: "100",
          maxAmount: "500",
          scope: "all",
        })
      )
    ).toBe(1 + 2 + 1 + 1 + 1);
  });

  it("counts the amount range once with only one side", () => {
    expect(activeFilterCount(f({ minAmount: "100" }))).toBe(1);
    expect(activeFilterCount(f({ maxAmount: "500" }))).toBe(1);
    expect(activeFilterCount(f({ minAmount: "junk" }))).toBe(0);
  });

  it("counts categories differing only by case once", () => {
    expect(activeFilterCount(f({ categories: ["Food", "food", " FOOD "] }))).toBe(1);
  });
});

describe("toSearchParams", () => {
  it("is empty for the empty filters without a ledger", () => {
    expect(toSearchParams(EMPTY_EXPENSE_FILTERS)).toEqual({});
  });

  it("adds the ledger for this month", () => {
    expect(toSearchParams(EMPTY_EXPENSE_FILTERS, "L1")).toEqual({ ledgerId: "L1" });
  });

  it("omits the ledger for all months", () => {
    expect(toSearchParams(f({ scope: "all" }), "L1")).toEqual({});
  });

  it("trims the search text and omits it when blank", () => {
    expect(toSearchParams(f({ q: "  piz  " }))).toEqual({ q: "piz" });
    expect(toSearchParams(f({ q: "   " }))).toEqual({});
  });

  it("sends type only when not all", () => {
    expect(toSearchParams(f({ type: "debit" }))).toEqual({ type: "debit" });
    expect(toSearchParams(f({ type: "credit" }))).toEqual({ type: "credit" });
    expect(toSearchParams(f({ type: "all" }))).toEqual({});
  });

  it("sends normalised unique category names", () => {
    expect(
      toSearchParams(f({ categories: ["  Food   court ", "food court", "Rent", "", "  "] }))
    ).toEqual({ category: ["Food court", "Rent"] });
  });

  it("sends uncategorized only when true", () => {
    expect(toSearchParams(f({ uncategorized: true }))).toEqual({ uncategorized: true });
    expect(toSearchParams(f({ uncategorized: false }))).toEqual({});
  });

  it("sends parsed amounts and omits ones that don't parse", () => {
    expect(toSearchParams(f({ minAmount: "1,200.50", maxAmount: "5,000" }))).toEqual({
      minAmount: 1200.5,
      maxAmount: 5000,
    });
    expect(toSearchParams(f({ minAmount: "abc", maxAmount: "500" }))).toEqual({
      maxAmount: 500,
    });
  });

  it("combines everything with the ledger for this month", () => {
    expect(
      toSearchParams(
        f({
          q: " cab ",
          type: "debit",
          categories: ["Travel"],
          uncategorized: true,
          minAmount: "100",
          maxAmount: "500",
        }),
        "L1"
      )
    ).toEqual({
      q: "cab",
      type: "debit",
      category: ["Travel"],
      uncategorized: true,
      minAmount: 100,
      maxAmount: 500,
      ledgerId: "L1",
    });
  });

  it("combines everything without the ledger for all months", () => {
    expect(
      toSearchParams(f({ q: "cab", type: "credit", categories: ["Refund"], scope: "all" }), "L1")
    ).toEqual({ q: "cab", type: "credit", category: ["Refund"] });
  });
});

describe("activeChips", () => {
  const month = "Oct 2026";

  it("is empty for the empty filters", () => {
    expect(activeChips(EMPTY_EXPENSE_FILTERS, month)).toEqual([]);
  });

  it("never makes a chip for the search text", () => {
    const chips = activeChips(f({ q: "pizza", scope: "all" }), month);
    expect(chips.map((c) => c.key)).toEqual(["scope"]);
  });

  it("shows the month, not removable, when filtering within this month", () => {
    expect(activeChips(f({ q: "pizza" }), month)).toEqual([
      { key: "scope", label: "Oct 2026", removable: false },
    ]);
    expect(activeChips(f({ type: "debit" }), month)).toEqual([
      { key: "scope", label: "Oct 2026", removable: false },
      { key: "type", label: "Money out" },
    ]);
  });

  it("shows All months for the all scope, removable", () => {
    const chips = activeChips(f({ scope: "all" }), month);
    expect(chips).toEqual([{ key: "scope", label: "All months" }]);
    expect(chips[0].removable).not.toBe(false);
  });

  it("leaves every chip but the month removable", () => {
    const chips = activeChips(
      f({ type: "debit", categories: ["Food"], uncategorized: true, minAmount: "100" }),
      month
    );
    expect(chips.filter((c) => c.removable === false).map((c) => c.key)).toEqual(["scope"]);
    expect(chips.slice(1).every((c) => c.removable !== false)).toBe(true);
  });

  it("labels the types", () => {
    expect(activeChips(f({ type: "debit", scope: "all" }), month)[1]).toEqual({
      key: "type",
      label: "Money out",
    });
    expect(activeChips(f({ type: "credit", scope: "all" }), month)[1]).toEqual({
      key: "type",
      label: "Money in",
    });
  });

  it("orders scope, type, categories, no category, amount", () => {
    expect(
      activeChips(
        f({
          q: "x",
          type: "credit",
          categories: ["Food", "Rent"],
          uncategorized: true,
          minAmount: "100",
          maxAmount: "500",
          scope: "all",
        }),
        month
      )
    ).toEqual([
      { key: "scope", label: "All months" },
      { key: "type", label: "Money in" },
      { key: "category:Food", label: "Food" },
      { key: "category:Rent", label: "Rent" },
      { key: "uncategorized", label: "No category" },
      { key: "amount", label: "₹100 – ₹500" },
    ]);
  });

  it("makes one chip per category, ignoring case duplicates", () => {
    expect(
      activeChips(f({ categories: [" Food  court", "FOOD COURT"], scope: "all" }), month)
    ).toEqual([
      { key: "scope", label: "All months" },
      { key: "category:Food court", label: "Food court" },
    ]);
  });

  it("labels one-sided amount ranges", () => {
    expect(activeChips(f({ minAmount: "1,200", scope: "all" }), month)[1]).toEqual({
      key: "amount",
      label: "Over ₹1,200",
    });
    expect(activeChips(f({ maxAmount: "500.5", scope: "all" }), month)[1]).toEqual({
      key: "amount",
      label: "Under ₹500.5",
    });
  });

  it("has no amount chip when neither side parses", () => {
    expect(activeChips(f({ minAmount: "abc", maxAmount: "-1" }), month)).toEqual([]);
  });
});

describe("removeChip", () => {
  const full = f({
    q: "cab",
    type: "debit",
    categories: ["Food", "Rent"],
    uncategorized: true,
    minAmount: "100",
    maxAmount: "500",
    scope: "all",
  });

  it("narrows the scope back to this month", () => {
    expect(removeChip(full, "scope")).toEqual({ ...full, scope: "month" });
  });

  it("resets the type", () => {
    expect(removeChip(full, "type")).toEqual({ ...full, type: "all" });
  });

  it("removes one category", () => {
    expect(removeChip(full, "category:Food")).toEqual({ ...full, categories: ["Rent"] });
  });

  it("removes a category case-insensitively, with every variant", () => {
    const dup = f({ categories: ["Food", "food", "Rent"] });
    expect(removeChip(dup, "category:FOOD").categories).toEqual(["Rent"]);
  });

  it("clears no category", () => {
    expect(removeChip(full, "uncategorized")).toEqual({ ...full, uncategorized: false });
  });

  it("clears both amounts", () => {
    expect(removeChip(full, "amount")).toEqual({ ...full, minAmount: "", maxAmount: "" });
  });

  it("leaves the filters alone for an unknown key", () => {
    expect(removeChip(full, "nope")).toBe(full);
  });

  it("does not mutate the input", () => {
    const before = JSON.parse(JSON.stringify(full));
    removeChip(full, "category:Food");
    removeChip(full, "amount");
    expect(full).toEqual(before);
  });

  it("removes every chip activeChips made", () => {
    let current = full;
    for (const chip of activeChips(full, "Oct 2026")) {
      current = removeChip(current, chip.key);
    }
    expect(current).toEqual({ ...EMPTY_EXPENSE_FILTERS, q: "cab" });
  });

  it("removing every removable chip of a month search leaves only the search text", () => {
    const monthSearch = { ...full, scope: "month" as const };
    let current: ExpenseFilters = monthSearch;
    for (const chip of activeChips(monthSearch, "Oct 2026")) {
      if (chip.removable === false) continue;
      current = removeChip(current, chip.key);
    }
    expect(current).toEqual({ ...EMPTY_EXPENSE_FILTERS, q: "cab" });
    expect(activeChips(current, "Oct 2026")).toEqual([
      { key: "scope", label: "Oct 2026", removable: false },
    ]);
  });
});

describe("totalsLabel", () => {
  it("is empty with no totals", () => {
    expect(totalsLabel(0, 0)).toBe("");
  });

  it("starts with a capital for money out only", () => {
    expect(totalsLabel(1200, 0)).toBe("Money out ₹1,200");
  });

  it("starts with a capital for money in only", () => {
    expect(totalsLabel(0, 500)).toBe("Money in ₹500");
  });

  it("uses sentence case for both", () => {
    expect(totalsLabel(1200, 500)).toBe("Money out ₹1,200, money in ₹500");
  });
});

describe("toggleCategory", () => {
  it("adds a new category, normalised", () => {
    expect(toggleCategory(f(), "  Food   court ").categories).toEqual(["Food court"]);
    expect(toggleCategory(f({ categories: ["Rent"] }), "Food").categories).toEqual([
      "Rent",
      "Food",
    ]);
  });

  it("removes a category case-insensitively", () => {
    expect(toggleCategory(f({ categories: ["Food", "Rent"] }), "food").categories).toEqual([
      "Rent",
    ]);
    expect(toggleCategory(f({ categories: ["Food court"] }), " FOOD  COURT ").categories).toEqual(
      []
    );
  });

  it("keeps the existing spelling of the others", () => {
    expect(toggleCategory(f({ categories: ["fOOd", "Rent"] }), "Gym").categories).toEqual([
      "fOOd",
      "Rent",
      "Gym",
    ]);
  });

  it("ignores a blank name", () => {
    const start = f({ categories: ["Food"] });
    expect(toggleCategory(start, "   ")).toBe(start);
  });

  it("leaves the other filters and the input alone", () => {
    const start = f({ type: "debit", categories: ["Food"] });
    const next = toggleCategory(start, "Rent");
    expect(next).toEqual({ ...start, categories: ["Food", "Rent"] });
    expect(start.categories).toEqual(["Food"]);
  });
});
