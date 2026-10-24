import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchExpensesApi } from "../api/expenseApi";
import { describeError } from "../api/axios";
import { logger } from "../utils/logger";
import { isFiltering, toSearchParams } from "../utils/expenseFilters";
import {
  EMPTY_SEARCH_SUMMARY,
  mergeResults,
  readSearchPage,
  searchDelay,
  type SearchParams,
} from "../utils/expenseSearchState";
import type { ExpenseFilters, ExpenseSearchSummary, IExpense } from "../types";

interface SearchState {
  results: IExpense[];
  summary: ExpenseSearchSummary | null;
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** The search this state belongs to (see `stateKey`). */
  forKey: string;
}

const IDLE: SearchState = {
  forKey: "idle",
  results: [],
  summary: null,
  nextCursor: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
};

// A month search with no month to search: zero matches, no request.
const NOTHING_TO_SEARCH: SearchState = {
  ...IDLE,
  forKey: "none",
  summary: EMPTY_SEARCH_SUMMARY,
};

/**
 * Search results for the Expenses list, kept apart from the Redux month list
 * and its cache, so searching never disturbs the normal list.
 *
 * Active only while `isFiltering(filters)`. Typing waits for a 300 ms pause;
 * any other change searches at once. Page 1 also asks for the summary (count
 * and totals of everything that matches); later pages follow the cursor.
 *
 * Every first-page request takes a new id, and a reply whose id is no longer
 * the latest is dropped, so a slow answer to "pi" can never replace the
 * answer to "pizza". A failed request keeps the rows already shown.
 *
 * A "month" search needs the month's ledger: without one there is nothing to
 * match (no `ledgerId` would mean every month), so it returns no rows and
 * makes no request.
 */
export function useExpenseSearch(filters: ExpenseFilters, ledgerId?: string) {
  const [state, setState] = useState<SearchState>(IDLE);

  const active = isFiltering(filters);
  const noMonth = active && filters.scope === "month" && !ledgerId;
  const enabled = active && !noMonth;

  const params = useMemo(() => toSearchParams(filters, ledgerId), [filters, ledgerId]);
  const paramsKey = JSON.stringify(params);
  const stateKey = enabled ? `search:${paramsKey}` : noMonth ? "none" : "idle";

  const requestId = useRef(0);
  const paramsRef = useRef<SearchParams>(params);
  const prevParams = useRef<SearchParams | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read by loadMore, which list callbacks may call twice before a re-render.
  const page = useRef({ enabled: false, cursor: null as string | null, busy: false });

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const fetchFirstPage = useCallback(async (p: SearchParams, id: number) => {
    try {
      const response = await searchExpensesApi({ ...p, includeSummary: true });
      if (id !== requestId.current) return;
      const { expenses, nextCursor, hasMore, summary } = readSearchPage(response.data);
      page.current.cursor = hasMore ? nextCursor : null;
      setState((s) => ({
        forKey: s.forKey,
        results: mergeResults([], expenses),
        summary,
        nextCursor,
        hasMore,
        loading: false,
        loadingMore: false,
        error: null,
      }));
    } catch (error) {
      if (id !== requestId.current) return;
      logger.error("Failed to search expenses:", error);
      setState((s) => ({ ...s, loading: false, error: describeError(error) }));
    }
  }, []);

  // `paramsKey` stands for `params`: same value, stable identity.
  useEffect(() => {
    const prev = prevParams.current;
    prevParams.current = params;
    paramsRef.current = params;
    page.current = { enabled, cursor: null, busy: false };
    clearTimer();
    // Whatever is in flight answers a question no longer asked.
    const id = ++requestId.current;

    if (!enabled) {
      const next = noMonth ? NOTHING_TO_SEARCH : IDLE;
      setState((s) => (s === next ? s : next));
      return;
    }

    setState((s) => ({
      ...s,
      forKey: stateKey,
      loading: true,
      loadingMore: false,
      error: null,
    }));
    timer.current = setTimeout(() => {
      timer.current = null;
      void fetchFirstPage(params, id);
    }, searchDelay(prev, params));
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, enabled, noMonth, fetchFirstPage]);

  // Replies landing after the screen has gone are dropped.
  useEffect(
    () => () => {
      requestId.current += 1;
      clearTimer();
    },
    [],
  );

  /** Page 1 and the totals again, at once (after an edit, a delete, a pull). */
  const refresh = useCallback(async () => {
    if (!page.current.enabled) return;
    clearTimer();
    page.current.cursor = null;
    page.current.busy = false;
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, loadingMore: false, error: null }));
    await fetchFirstPage(paramsRef.current, id);
  }, [fetchFirstPage]);

  /** The next page, appended without rows already shown. */
  const loadMore = useCallback(() => {
    const { enabled: on, cursor, busy } = page.current;
    if (!on || busy || !cursor) return;
    page.current.busy = true;
    const id = requestId.current;
    setState((s) => ({ ...s, loadingMore: true }));

    searchExpensesApi(paramsRef.current, cursor)
      .then((response) => {
        if (id !== requestId.current) return;
        const next = readSearchPage(response.data);
        page.current.cursor = next.hasMore ? next.nextCursor : null;
        setState((s) => ({
          ...s,
          results: mergeResults(s.results, next.expenses),
          nextCursor: next.nextCursor,
          hasMore: next.hasMore,
          loadingMore: false,
        }));
      })
      .catch((error) => {
        if (id !== requestId.current) return;
        logger.error("Failed to load more search results:", error);
        setState((s) => ({ ...s, loadingMore: false, error: describeError(error) }));
      })
      .finally(() => {
        if (id === requestId.current) page.current.busy = false;
      });
  }, []);

  /** Takes a deleted row off the results at once; `refresh` brings the totals. */
  const removeLocal = useCallback((id: string) => {
    setState((s) => ({ ...s, results: s.results.filter((e) => e._id !== id) }));
  }, []);

  return {
    results: state.results,
    summary: state.summary,
    // Also true for the render between a filter change and its effect, so
    // the list never flashes "No expenses match." before the search starts.
    loading: state.loading || state.forKey !== stateKey,
    loadingMore: state.loadingMore,
    hasMore: state.hasMore,
    error: state.error,
    loadMore,
    refresh,
    removeLocal,
  };
}
