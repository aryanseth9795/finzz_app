import type {
  ExpenseFilters,
  ExpenseHomeParams,
  ExpenseSearchSummary,
  IExpense,
  IExpenseLedger,
} from "../types";
import { EMPTY_EXPENSE_FILTERS } from "../constants/expenseFilters";
import { monthLabel, type YearMonth } from "./months";

/**
 * Pure state helpers behind `useExpenseSearch` and the Expenses screen's
 * search mode: merging result pages, reading a reply, when to wait for a
 * pause in typing, and the report's deep link. Kept out of the hook and the
 * screen so they can be tested without a renderer.
 */

/** How long typing must pause before the search text is sent. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Zero matches: shown when there is nothing to ask the server for. */
export const EMPTY_SEARCH_SUMMARY: ExpenseSearchSummary = {
  count: 0,
  debitTotal: 0,
  creditTotal: 0,
};

/** Query params of one search, as built by `toSearchParams`. */
export type SearchParams = Record<string, string | number | boolean | string[]>;

/** One page of search results. */
export interface ExpenseSearchPage {
  expenses: IExpense[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Only on page 1, which asks for it. */
  summary: ExpenseSearchSummary | null;
}

/**
 * The loaded rows followed by the next page, without any row twice. A row
 * already on screen keeps its place and data, so an edit landing between
 * two pages can't make it jump or show twice.
 */
export const mergeResults = (loaded: IExpense[], incoming: IExpense[]): IExpense[] => {
  const seen = new Set(loaded.map((e) => e._id));
  const merged = [...loaded];
  for (const e of incoming) {
    if (seen.has(e._id)) continue;
    seen.add(e._id);
    merged.push(e);
  }
  return merged;
};

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * A search reply as a page. A malformed reply reads as an empty last page,
 * and a page without a cursor never claims more, so scrolling can't ask for
 * "the page after null" (page 1 again).
 */
export const readSearchPage = (raw: unknown): ExpenseSearchPage => {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const expenses = Array.isArray(data.expenses) ? (data.expenses as IExpense[]) : [];
  const nextCursor = typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null;
  const s = data.summary as Partial<ExpenseSearchSummary> | null | undefined;
  const summary =
    s && isNumber(s.count) && isNumber(s.debitTotal) && isNumber(s.creditTotal)
      ? { count: s.count, debitTotal: s.debitTotal, creditTotal: s.creditTotal }
      : null;
  return { expenses, nextCursor, hasMore: data.hasMore === true && nextCursor !== null, summary };
};

const sameValue = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
};

/**
 * Milliseconds to wait before searching `next`: a pause in typing when only
 * the search text differs from `prev`, otherwise none (a chip, the sheet or
 * the month changed, and the user expects the list to follow at once).
 */
export const searchDelay = (prev: SearchParams | null, next: SearchParams): number => {
  if (!prev) return 0;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  keys.delete("q");
  for (const key of keys) {
    if (!sameValue(prev[key], next[key])) return 0;
  }
  return sameValue(prev.q, next.q) ? 0 : SEARCH_DEBOUNCE_MS;
};

/** The ledger of one calendar month, or null when that month has none. */
export const findLedger = (
  ledgers: IExpenseLedger[],
  year: number,
  month: number,
): IExpenseLedger | null => ledgers.find((l) => l.year === year && l.month === month) ?? null;

type ReportFilter = NonNullable<ExpenseHomeParams["filter"]>;

/**
 * What the report's "Where it went" tap opens: the ledger of its month and
 * the filters for its category. The report's "Other" arrives as the category
 * "Other" plus `uncategorized`, and both are kept. A month with no ledger
 * can't be searched by month, so the search widens to all months.
 */
export const filtersFromReport = (
  param: ReportFilter,
  ledgers: IExpenseLedger[],
): { ledger: IExpenseLedger | null; filters: ExpenseFilters } => {
  const ledger = findLedger(ledgers, param.year, param.month);
  const category = param.category?.trim();
  return {
    ledger,
    filters: {
      ...EMPTY_EXPENSE_FILTERS,
      categories: category ? [category] : [],
      uncategorized: !!param.uncategorized,
      scope: ledger ? "month" : "all",
    },
  };
};

/** "Oct 2026" for a ledger month; "This month" before any ledger exists. */
export const ledgerMonthName = (ledger: YearMonth | null | undefined): string =>
  ledger ? monthLabel(ledger, "short") : "This month";

/**
 * Whether a result row can be edited or deleted: rows of a closed month are
 * read-only, as in the month list. Results can span months, so this looks up
 * the row's own ledger; one not loaded here is left for the server to judge.
 */
export const isExpenseEditable = (expense: IExpense, ledgers: IExpenseLedger[]): boolean =>
  ledgers.find((l) => l._id === expense.ledgerId)?.status !== "closed";
