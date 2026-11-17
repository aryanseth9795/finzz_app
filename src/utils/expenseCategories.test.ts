import { describe, expect, it } from "vitest";
import type { IExpenseCategory } from "../types";
import {
  categoryChangedOnEdit,
  categoryKey,
  chipsFor,
  findCategory,
  isNewCategory,
  isStorableCategory,
  normalizeCategoryName,
  resolveSpelling,
} from "./expenseCategories";

const cat = (
  _id: string,
  name: string,
  type: IExpenseCategory["type"] = "debit"
): IExpenseCategory => ({ _id, name, type });

const list: IExpenseCategory[] = [
  cat("r", "Rent"),
  cat("f", "Food"),
  cat("u", "Fuel"),
  cat("fc", "Food court"),
  cat("s", "Salary", "credit"),
  cat("rf", "Refund", "credit"),
];

// Same cases as the server's service test, so phone and server agree.
describe("normalizeCategoryName", () => {
  it("trims and collapses runs of whitespace", () => {
    expect(normalizeCategoryName("  Food   court ")).toBe("Food court");
  });
  it("treats tabs and newlines as whitespace", () => {
    expect(normalizeCategoryName("\tFood\n\n court\t")).toBe("Food court");
  });
  it("keeps the spelling and case", () => {
    expect(normalizeCategoryName("FOOD")).toBe("FOOD");
  });
  it("is empty for blank input", () => {
    expect(normalizeCategoryName("   ")).toBe("");
    expect(normalizeCategoryName("")).toBe("");
  });
});

describe("categoryKey", () => {
  it("is the normalised name lowercased", () => {
    expect(categoryKey("  FOOD  Court")).toBe("food court");
    expect(categoryKey("  Food   court ")).toBe("food court");
  });
});

describe("isStorableCategory", () => {
  it("rejects '-', blank and non-strings", () => {
    expect(isStorableCategory("-")).toBe(false);
    expect(isStorableCategory(" - ")).toBe(false);
    expect(isStorableCategory("   ")).toBe(false);
    expect(isStorableCategory("")).toBe(false);
    expect(isStorableCategory(42)).toBe(false);
    expect(isStorableCategory(null)).toBe(false);
    expect(isStorableCategory(undefined)).toBe(false);
  });
  it("accepts a real name", () => {
    expect(isStorableCategory("Food")).toBe(true);
    expect(isStorableCategory("  Food   court ")).toBe(true);
  });
});

describe("findCategory", () => {
  it("matches by key within the type", () => {
    expect(findCategory(list, "debit", "  FOOD ")?._id).toBe("f");
    expect(findCategory(list, "debit", "food   COURT")?._id).toBe("fc");
  });
  it("does not match across types", () => {
    expect(findCategory(list, "credit", "Food")).toBeUndefined();
    expect(findCategory(list, "debit", "Salary")).toBeUndefined();
  });
  it("is undefined for blank text", () => {
    expect(findCategory(list, "debit", "")).toBeUndefined();
    expect(findCategory(list, "debit", "   ")).toBeUndefined();
  });
});

describe("chipsFor", () => {
  const names = (cs: IExpenseCategory[]) => cs.map((c) => c.name);

  it("filters by type", () => {
    expect(names(chipsFor(list, "credit", ""))).toEqual(["Refund", "Salary"]);
  });
  it("matches 'contains', ignoring case", () => {
    expect(names(chipsFor(list, "debit", "fo"))).toEqual(["Food", "Food court"]);
    expect(names(chipsFor(list, "debit", "U"))).toEqual(["Food court", "Fuel"]);
  });
  it("'f' matches Food and Fuel but not Rent", () => {
    const got = names(chipsFor(list, "debit", "f"));
    expect(got).toContain("Food");
    expect(got).toContain("Fuel");
    expect(got).not.toContain("Rent");
  });
  it("normalises the query", () => {
    expect(names(chipsFor(list, "debit", "  FOOD   c"))).toEqual(["Food court"]);
  });
  it("returns every chip of the type A-Z for an empty query", () => {
    expect(names(chipsFor(list, "debit", ""))).toEqual(["Food", "Food court", "Fuel", "Rent"]);
    expect(names(chipsFor(list, "debit", "   "))).toEqual(["Food", "Food court", "Fuel", "Rent"]);
  });
  it("sorts by key, not by stored case", () => {
    const mixed = [cat("b", "banana"), cat("a", "Apple"), cat("c", "CHERRY")];
    expect(names(chipsFor(mixed, "debit", ""))).toEqual(["Apple", "banana", "CHERRY"]);
  });
  it("does not mutate the input", () => {
    const copy = [...list];
    chipsFor(list, "debit", "");
    expect(list).toEqual(copy);
  });
  it("is empty when nothing matches", () => {
    expect(chipsFor(list, "debit", "xyz")).toEqual([]);
    expect(chipsFor([], "debit", "")).toEqual([]);
  });
});

describe("isNewCategory", () => {
  it("is false for a different case of an existing name", () => {
    expect(isNewCategory(list, "debit", "food")).toBe(false);
    expect(isNewCategory(list, "debit", "  FOOD   court ")).toBe(false);
  });
  it("is true for the same name in the other type", () => {
    expect(isNewCategory(list, "credit", "food")).toBe(true);
  });
  it("is true for a name not in the list", () => {
    expect(isNewCategory(list, "debit", "Groceries")).toBe(true);
  });
  it("is false for '-' and blank", () => {
    expect(isNewCategory(list, "debit", "-")).toBe(false);
    expect(isNewCategory(list, "debit", "  ")).toBe(false);
    expect(isNewCategory([], "debit", "")).toBe(false);
  });
});

describe("resolveSpelling", () => {
  it("uses the stored spelling when the key matches", () => {
    expect(resolveSpelling(list, "debit", "food")).toBe("Food");
    expect(resolveSpelling(list, "debit", "FOOD  COURT")).toBe("Food court");
  });
  it("returns the normalised text otherwise", () => {
    expect(resolveSpelling(list, "debit", "  Food   court ")).toBe("Food court");
    expect(resolveSpelling(list, "debit", "  Petrol   pump ")).toBe("Petrol pump");
  });
  it("does not borrow a spelling from the other type", () => {
    expect(resolveSpelling(list, "credit", "food")).toBe("food");
  });
});

describe("categoryChangedOnEdit", () => {
  it("is false for the same text with different case or spaces and the same type", () => {
    expect(
      categoryChangedOnEdit({ category: "food", type: "debit" }, { category: "  FOOD ", type: "debit" })
    ).toBe(false);
    expect(
      categoryChangedOnEdit(
        { category: "Food court", type: "debit" },
        { category: "food   court", type: "debit" }
      )
    ).toBe(false);
  });
  it("is true when only the type changed (debit to credit)", () => {
    expect(
      categoryChangedOnEdit({ category: "Food", type: "debit" }, { category: "Food", type: "credit" })
    ).toBe(true);
  });
  it("is true when the text changed", () => {
    expect(
      categoryChangedOnEdit({ category: "Food", type: "debit" }, { category: "Food court", type: "debit" })
    ).toBe(true);
  });
  it("is true when the original had no category", () => {
    expect(categoryChangedOnEdit({ type: "debit" }, { category: "Food", type: "debit" })).toBe(true);
    expect(
      categoryChangedOnEdit({ category: null, type: "debit" }, { category: "Food", type: "debit" })
    ).toBe(true);
  });
  it("is false when both are blank and the type is the same", () => {
    expect(categoryChangedOnEdit({ category: undefined, type: "debit" }, { category: "", type: "debit" })).toBe(
      false
    );
  });
});
