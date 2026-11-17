/**
 * Pure helpers for the report's "Where it went" card: the category list,
 * the donut slices built from it, and what a tap on a row opens.
 *
 * The list shows every category; the donut keeps the top few plus one
 * "Others" slice so thin slices stay readable and tappable.
 */
import type { ExpenseHomeParams, IAdvancedExpenseStats } from "../../types";

type Breakdown = IAdvancedExpenseStats["categoryBreakdown"];
type Trend = NonNullable<IAdvancedExpenseStats["categoryTrend"]>;
type ExpenseFilterParam = NonNullable<ExpenseHomeParams["filter"]>;

export interface CategoryRow {
  name: string;
  total: number;
  /** Number of transactions in the month; 0 when the server sent none. */
  count: number;
  /** Share of all categorised spending, 0-100. */
  share: number;
  /** Monthly totals, oldest first; null when the server sent no trend. */
  trend: number[] | null;
}

export interface DonutSlice {
  label: string;
  value: number;
  isOthers: boolean;
}

/** Rows shown before the "Show N more" row. */
export const CATEGORY_LIST_LIMIT = 10;
/** Categories that get their own donut slice. */
export const DONUT_TOP_N = 7;
/** Slices below this share (percent) are folded into "Others". */
export const DONUT_MIN_PCT = 1;

const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

const nameKey = (name: string): string => name.trim().toLowerCase();

/**
 * Every category with a positive total, largest first (ties by name), with
 * its share and its 3-month trend attached. The trend is matched by exact
 * name first, then ignoring case and outer spaces.
 */
export const buildCategoryRows = (
  breakdown: Breakdown | null | undefined,
  trend: Trend | null | undefined,
): CategoryRow[] => {
  const kept = (breakdown ?? []).filter(
    (c) => c && typeof c.name === "string" && finite(c.total) && c.total > 0,
  );
  const sum = kept.reduce((a, c) => a + c.total, 0);

  const exact = new Map<string, number[]>();
  const loose = new Map<string, number[]>();
  for (const t of trend ?? []) {
    if (!t || typeof t.name !== "string" || !Array.isArray(t.months)) continue;
    const series = t.months.map((m) => (finite(m?.total) ? m.total : 0));
    if (!exact.has(t.name)) exact.set(t.name, series);
    const key = nameKey(t.name);
    if (!loose.has(key)) loose.set(key, series);
  }

  return kept
    .map<CategoryRow>((c) => ({
      name: c.name,
      total: c.total,
      count: finite(c.count) && c.count > 0 ? Math.round(c.count) : 0,
      share: sum > 0 ? (c.total / sum) * 100 : 0,
      trend: exact.get(c.name) ?? loose.get(nameKey(c.name)) ?? null,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
};

/**
 * Donut slices for rows sorted largest first. Slice i is row i up to
 * `othersStart`; everything from there (past the top N, or under minPct)
 * is one "Others (n)" slice. `othersStart` is null when nothing was folded.
 */
export const donutSlices = (
  rows: CategoryRow[],
  topN: number = DONUT_TOP_N,
  minPct: number = DONUT_MIN_PCT,
): { slices: DonutSlice[]; othersStart: number | null } => {
  let cut = Math.min(rows.length, topN);
  // Sorted descending, so the slices under minPct are a suffix.
  const firstTiny = rows.findIndex((r) => r.share < minPct);
  if (firstTiny !== -1 && firstTiny < cut) cut = firstTiny;

  const slices: DonutSlice[] = rows.slice(0, cut).map((r) => ({
    label: r.name,
    value: r.total,
    isOthers: false,
  }));
  const rest = rows.slice(cut);
  if (rest.length === 0) return { slices, othersStart: null };

  slices.push({
    label: `Others (${rest.length})`,
    value: rest.reduce((a, r) => a + r.total, 0),
    isOthers: true,
  });
  return { slices, othersStart: cut };
};

/** How many list rows to render: all when expanded or within the limit. */
export const visibleRowCount = (
  total: number,
  expanded: boolean,
  limit: number = CATEGORY_LIST_LIMIT,
): number => (expanded || total <= limit ? total : limit);

/**
 * Whether list row `rowIndex` is tinted for the selected donut slice: the
 * matching row for a top slice, every folded row for the "Others" slice.
 */
export const isRowHighlighted = (
  rowIndex: number,
  selectedSlice: number | null,
  othersStart: number | null,
): boolean => {
  if (selectedSlice === null) return false;
  if (othersStart !== null && selectedSlice === othersStart) {
    return rowIndex >= othersStart;
  }
  return rowIndex === selectedSlice;
};

export const transactionCountLabel = (count: number): string =>
  `${count} ${count === 1 ? "transaction" : "transactions"}`;

/**
 * The Expenses-list filter a tap on a category row opens: that category in
 * the report's month, money out only. The report's categories are built from
 * debits alone, so the filter always asks for debits; without it a credit in
 * the same category (for "Other", every untagged salary or refund) would show
 * in the list but not in the report. The "Other" bucket holds both
 * uncategorized rows (no tag, blank or "-") and rows literally named "Other",
 * so it asks for both; the server ORs a category with uncategorized, and the
 * list then shows exactly the rows the report counted.
 */
export const categoryFilterFor = (
  name: string,
  selectedMonth: { year: number; month: number },
): ExpenseFilterParam =>
  nameKey(name) === "other"
    ? {
        year: selectedMonth.year,
        month: selectedMonth.month,
        category: "Other",
        uncategorized: true,
        type: "debit",
      }
    : {
        year: selectedMonth.year,
        month: selectedMonth.month,
        category: name,
        type: "debit",
      };
