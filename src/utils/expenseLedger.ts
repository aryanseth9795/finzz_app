import type { IExpense, IExpenseLedger } from "../types";

/** The ledger to open by default: the current month, else the first available. */
export const pickInitialLedger = (
  ledgers: IExpenseLedger[],
  now: Date = new Date(),
): IExpenseLedger | null => {
  if (ledgers.length === 0) return null;
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return ledgers.find((l) => l.year === year && l.month === month) ?? ledgers[0];
};

interface YearMonth {
  year: number;
  month: number;
}

const monthIndex = ({ year, month }: YearMonth) => year * 12 + month;

/**
 * Whether a ledger load should move a past active month to the current one.
 *
 * The jump is for a month ROLLOVER only. Every focus reloads the ledgers, and
 * the server always creates the current month's ledger, so a plain "active
 * is before this month" check fired on every focus: pick October → tap + →
 * save → `goBack` focuses the list → it jumped to November, and the entry
 * just added was no longer visible.
 *
 * - `active` is this month or later → stay.
 * - No `lastSeenToday` (first load since mount) → follow: the past month came
 *   from the cache or an earlier session, so it is stale.
 * - `lastSeenToday` is this month → stay: no rollover since the last load,
 *   so the user chose this past month.
 * - The month rolled over since the last load → follow only when `active` is
 *   the month that just ended (the user was on "this month"); an older month
 *   the user picked stays.
 */
export const shouldFollowCurrentMonth = (
  active: YearMonth,
  today: YearMonth,
  lastSeenToday: YearMonth | null,
): boolean => {
  if (monthIndex(active) >= monthIndex(today)) return false;
  if (lastSeenToday === null) return true;
  if (monthIndex(lastSeenToday) === monthIndex(today)) return false;
  return monthIndex(active) === monthIndex(lastSeenToday);
};

export interface ExpensePage {
  expenses: IExpense[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Normalise the cached first page of expenses.
 *
 * The cache used to hold a bare array, restored as `{ nextCursor: null,
 * hasMore: true }` — so scrolling before the fresh response landed asked for
 * "the page after null", i.e. page 1 again. A page without a cursor can never
 * claim more pages.
 */
export const readCachedPage = (raw: unknown): ExpensePage | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return { expenses: raw as IExpense[], nextCursor: null, hasMore: false };
  }
  const page = raw as Partial<ExpensePage>;
  if (!Array.isArray(page.expenses)) return null;
  const nextCursor = typeof page.nextCursor === "string" ? page.nextCursor : null;
  return {
    expenses: page.expenses,
    nextCursor,
    hasMore: !!page.hasMore && nextCursor !== null,
  };
};
