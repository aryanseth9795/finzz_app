import type { ExpenseFilterChip, ExpenseFilters } from "../types";
import { formatNumber } from "./money";
import { categoryKey, normalizeCategoryName } from "./expenseCategories";

/**
 * Search and filter helpers for the Expenses list.
 *
 * `ExpenseFilters` keeps the amount inputs as typed text; everything here
 * reads them through `parseAmountInput`, so the sheet, the chip row, the
 * filter-icon dot and the request all agree on whether a range is set.
 *
 * Categories are matched like the server does (case- and space-insensitive),
 * so "Food" and " food " are one filter, one chip and one query value.
 */

/** Plain decimal after commas are removed: "1200", "1200.5", ".5", "12.". */
const AMOUNT_PATTERN = /^(\d+(\.\d*)?|\.\d+)$/;

/**
 * A typed amount bound as a number, or undefined when it is blank, not a
 * plain number, or negative. Thousands separators are allowed ("1,200.50",
 * "1,20,000"); the result is rounded to paise.
 */
export const parseAmountInput = (text: string): number | undefined => {
  const cleaned = (text ?? "").trim().replace(/,/g, "");
  if (!AMOUNT_PATTERN.test(cleaned)) return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
};

/** The sheet's message when both bounds are set and max is below min. */
export const amountRangeError = (f: ExpenseFilters): string | null => {
  const min = parseAmountInput(f.minAmount);
  const max = parseAmountInput(f.maxAmount);
  if (min !== undefined && max !== undefined && max < min) {
    return "Max must be at least min";
  }
  return null;
};

/** Normalised, non-blank category names with case/space duplicates dropped (first spelling wins). */
const uniqueCategories = (f: ExpenseFilters): string[] => {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of f.categories ?? []) {
    const name = normalizeCategoryName(raw);
    const key = name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
};

const hasAmountRange = (f: ExpenseFilters): boolean =>
  parseAmountInput(f.minAmount) !== undefined || parseAmountInput(f.maxAmount) !== undefined;

/** True when the list should show search results instead of the normal month list. */
export const isFiltering = (f: ExpenseFilters): boolean =>
  f.q.trim() !== "" ||
  f.type !== "all" ||
  uniqueCategories(f).length > 0 ||
  f.uncategorized ||
  hasAmountRange(f) ||
  f.scope === "all";

/**
 * Filters set in the sheet, for the filter icon's badge. The search text is
 * not counted. Each category counts; the amount range counts once.
 */
export const activeFilterCount = (f: ExpenseFilters): number =>
  (f.type !== "all" ? 1 : 0) +
  uniqueCategories(f).length +
  (f.uncategorized ? 1 : 0) +
  (hasAmountRange(f) ? 1 : 0) +
  (f.scope === "all" ? 1 : 0);

/**
 * Query params for `GET /expenses`. Unset filters are left out. `ledgerId`
 * is what limits the search to this month, so it is sent only for the
 * "month" scope.
 */
export const toSearchParams = (
  f: ExpenseFilters,
  ledgerId?: string
): Record<string, string | number | boolean | string[]> => {
  const params: Record<string, string | number | boolean | string[]> = {};

  const q = f.q.trim();
  if (q) params.q = q;
  if (f.type !== "all") params.type = f.type;

  const categories = uniqueCategories(f);
  if (categories.length > 0) params.category = categories;
  if (f.uncategorized) params.uncategorized = true;

  const min = parseAmountInput(f.minAmount);
  const max = parseAmountInput(f.maxAmount);
  if (min !== undefined) params.minAmount = min;
  if (max !== undefined) params.maxAmount = max;

  if (f.scope === "month" && ledgerId) params.ledgerId = ledgerId;
  return params;
};

const TYPE_LABELS: Record<"debit" | "credit", string> = {
  debit: "Money out",
  credit: "Money in",
};

const CATEGORY_PREFIX = "category:";

const amountLabel = (min: number | undefined, max: number | undefined): string | null => {
  if (min !== undefined && max !== undefined) {
    return `₹${formatNumber(min)} – ₹${formatNumber(max)}`;
  }
  if (min !== undefined) return `Over ₹${formatNumber(min)}`;
  if (max !== undefined) return `Under ₹${formatNumber(max)}`;
  return null;
};

/**
 * Chips for the active-filter row, in order: scope, type, categories,
 * "No category", amount. The search text never gets a chip. The month chip
 * (`monthName`, e.g. "Oct 2026") shows only while something else is being
 * searched or filtered, so the plain month list has no chips. It only says
 * what the search covers: "month" is already the narrowest scope, so it is
 * `removable: false`. "All months" stays removable (back to this month).
 */
export const activeChips = (f: ExpenseFilters, monthName: string): ExpenseFilterChip[] => {
  const chips: ExpenseFilterChip[] = [];

  if (f.scope === "all") {
    chips.push({ key: "scope", label: "All months" });
  } else if (isFiltering(f)) {
    chips.push({ key: "scope", label: monthName, removable: false });
  }

  if (f.type !== "all") chips.push({ key: "type", label: TYPE_LABELS[f.type] });

  for (const name of uniqueCategories(f)) {
    chips.push({ key: `${CATEGORY_PREFIX}${name}`, label: name });
  }

  if (f.uncategorized) chips.push({ key: "uncategorized", label: "No category" });

  const amount = amountLabel(parseAmountInput(f.minAmount), parseAmountInput(f.maxAmount));
  if (amount) chips.push({ key: "amount", label: amount });

  return chips;
};

/**
 * The spoken form of the search totals, in sentence case: "Money out ₹1,200,
 * money in ₹500", "Money in ₹500", or "" when both are zero.
 */
export const totalsLabel = (debitTotal: number, creditTotal: number): string => {
  const parts: string[] = [];
  if (debitTotal > 0) parts.push(`money out ₹${formatNumber(debitTotal)}`);
  if (creditTotal > 0) parts.push(`money in ₹${formatNumber(creditTotal)}`);
  const text = parts.join(", ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

/** Filters without the one a chip stands for. An unknown key returns `f` unchanged. */
export const removeChip = (f: ExpenseFilters, key: string): ExpenseFilters => {
  if (key === "scope") return { ...f, scope: "month" };
  if (key === "type") return { ...f, type: "all" };
  if (key === "uncategorized") return { ...f, uncategorized: false };
  if (key === "amount") return { ...f, minAmount: "", maxAmount: "" };
  if (key.startsWith(CATEGORY_PREFIX)) {
    const target = categoryKey(key.slice(CATEGORY_PREFIX.length));
    return { ...f, categories: f.categories.filter((c) => categoryKey(c) !== target) };
  }
  return f;
};

/**
 * Select or unselect a category. Matching ignores case and extra spaces;
 * a new name is added normalised, and the other names keep their spelling.
 */
export const toggleCategory = (f: ExpenseFilters, name: string): ExpenseFilters => {
  const normalized = normalizeCategoryName(name);
  const key = normalized.toLowerCase();
  if (!key) return f;

  const remaining = f.categories.filter((c) => categoryKey(c) !== key);
  if (remaining.length !== f.categories.length) return { ...f, categories: remaining };
  return { ...f, categories: [...f.categories, normalized] };
};
