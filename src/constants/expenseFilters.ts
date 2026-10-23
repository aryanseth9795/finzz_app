import type { ExpenseFilters } from "../types";

/** No search and no filters: the normal month list. */
export const EMPTY_EXPENSE_FILTERS: ExpenseFilters = {
  q: "",
  type: "all",
  categories: [],
  uncategorized: false,
  minAmount: "",
  maxAmount: "",
  scope: "month",
};
