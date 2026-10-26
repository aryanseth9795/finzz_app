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
