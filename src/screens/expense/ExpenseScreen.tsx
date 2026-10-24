import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Avatar } from "../../components/ui";
import { useTheme } from "../../contexts/ThemeContext";
import { store, useAppSelector, useAppDispatch } from "../../store";
import {
  setExpenses,
  appendExpenses,
  setLedgers,
  setActiveLedger,
  updateLedger,
  setLoading,
  setTxLoading,
  removeExpense,
} from "../../store/slices/expenseSlice";
import {
  getExpensesApi,
  getExpenseLedgersApi,
  closeLedgerApi,
  deleteExpenseApi,
} from "../../api/expenseApi";
import {
  ExpenseFilters,
  ExpenseHomeParams,
  IExpense,
  IExpenseCategory,
  IExpenseLedger,
} from "../../types";
import { cacheManager, CACHE_KEYS } from "../../utils/cacheManager";
import { describeError } from "../../api/axios";
import { CACHE_DURATION } from "../../constants/api";
import { logger } from "../../utils/logger";
import { pickInitialLedger, readCachedPage } from "../../utils/expenseLedger";
import { formatNumber } from "../../utils/money";
import { withAlpha } from "../../utils/chartPalette";
import {
  categoryColorIndex,
  categoryInitial,
  dayKeyOf,
  dayLabel,
  dayTotals,
  displayCategory,
  localDayKey,
  rowText,
  startsNewDay,
} from "../../utils/expenseList";
import { EMPTY_EXPENSE_FILTERS } from "../../constants/expenseFilters";
import {
  activeChips,
  activeFilterCount,
  isFiltering,
  removeChip,
} from "../../utils/expenseFilters";
import {
  filtersFromReport,
  isExpenseEditable,
  ledgerMonthName,
} from "../../utils/expenseSearchState";
import {
  readSavedCategories,
  subscribeCategories,
} from "../../utils/expenseCategorySync";
import { useExpenseSearch } from "../../hooks/useExpenseSearch";
import ExpenseSearchBar from "./ExpenseSearchBar";
import ExpenseFilterSheet from "./ExpenseFilterSheet";
import ActiveFilterRow from "./ActiveFilterRow";

// Text/icons on coloured fills stay white; the theme has no on-primary token.
const ON_ACCENT = "#FFFFFF";
// Room under the last row so the + button (56 tall, 24 from the bottom) never covers it.
const LIST_BOTTOM_SPACE = 96;

const ExpenseScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius, fontSize, fontWeight } = theme;
  const dispatch = useAppDispatch();

  const { expenses, ledgers, activeLedger, txLoading, nextCursor, hasMore } =
    useAppSelector((state) => state.expense);
  const user = useAppSelector((state) => state.auth.user);

  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showLedgerPicker, setShowLedgerPicker] = useState(false);
  // True once a ledger request has finished, so the report link can tell
  // "no ledgers" from "not loaded yet".
  const [ledgersFetched, setLedgersFetched] = useState(false);

  /**
   * Search and filters. While anything is set, the list shows the search
   * results instead of the month list; the month list, its cache and its
   * Redux state stay as they are, so clearing shows them again at once.
   */
  const [filters, setFilters] = useState<ExpenseFilters>(
    EMPTY_EXPENSE_FILTERS,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [savedCategories, setSavedCategories] = useState<IExpenseCategory[]>(
    [],
  );
  const filtering = isFiltering(filters);
  const filterCount = activeFilterCount(filters);
  const search = useExpenseSearch(filters, activeLedger?._id);
  const monthName = ledgerMonthName(activeLedger);
  const reportFilter = (route?.params as ExpenseHomeParams | undefined)
    ?.filter;

  /**
   * While set, a ledger load keeps the selected month instead of jumping to
   * the current one: during a search (the results would change under the
   * user) and after the report opened a past month.
   */
  const holdLedgerRef = useRef(false);
  // Read by the focus callback, which is created once.
  const filteringRef = useRef(false);
  const reportFilterRef = useRef(reportFilter);
  useEffect(() => {
    filteringRef.current = filtering;
    holdLedgerRef.current = filtering;
  }, [filtering]);
  useEffect(() => {
    reportFilterRef.current = reportFilter;
  }, [reportFilter]);

  // The rows on screen: search results while filtering, else the month list.
  const listData = filtering ? search.results : expenses;
  // Day totals over the rows loaded so far; a day split across pages fills in
  // as the next page arrives.
  const totalsByDay = useMemo(() => dayTotals(listData), [listData]);
  const todayKey = localDayKey();
  const isLedgerOpen = activeLedger?.status === "open";

  /**
   * One trigger, not two.
   *
   * A mount effect AND a focus listener both ran on the initial mount, and
   * each `loadLedgers` dispatched `setActiveLedger` with a NEW OBJECT
   * IDENTITY — which re-triggered the `[activeLedger]` effect below and
   * fetched the expense list again. Opening this tab issued four or more
   * requests where two suffice, and `handleRefresh` closed the loop by
   * running `loadLedgers` and `loadExpenses` concurrently, producing a third
   * writer to the same slice.
   *
   * `useFocusEffect` covers both cases: it runs on the first focus and on
   * every later one. A raw `focus` listener added in an effect is registered
   * after the screen has already focused, so it can miss the initial load.
   */
  useFocusEffect(
    useCallback(() => {
      void loadLedgers();
      // Back from an edit: the results may have changed. A pending report
      // link brings new filters, so the old ones aren't searched first.
      if (filteringRef.current && !reportFilterRef.current) {
        void search.refresh();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const loadLedgers = async (isManualRefresh = false) => {
    try {
      const cached = await cacheManager.get<IExpenseLedger[]>(
        CACHE_KEYS.EXPENSE_LEDGERS,
        CACHE_DURATION.EXPENSES,
      );
      if (cached) {
        dispatch(setLedgers(cached));
        // Open the cached ledger immediately so its expenses load in parallel
        // with the ledger request below, instead of waiting for it. The
        // network result keeps the same ledger ID, so it does not refetch.
        if (!store.getState().expense.activeLedger) {
          const initial = pickInitialLedger(cached);
          if (initial) dispatch(setActiveLedger(initial));
        }
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const response = await getExpenseLedgersApi(currentYear, currentMonth);
      const ledgerList: IExpenseLedger[] = response.data.ledgers;
      dispatch(setLedgers(ledgerList));
      await cacheManager.set(CACHE_KEYS.EXPENSE_LEDGERS, ledgerList);

      const currentActiveLedger = store.getState().expense.activeLedger;

      const currentRealWorldLedger = ledgerList.find(
        (l) => l.year === currentYear && l.month === currentMonth,
      );

      if (
        !isManualRefresh &&
        !holdLedgerRef.current &&
        currentActiveLedger &&
        (currentActiveLedger.year < currentYear ||
          (currentActiveLedger.year === currentYear &&
            currentActiveLedger.month < currentMonth)) &&
        currentRealWorldLedger
      ) {
        // Active ledger is from a past month and we are booting/focusing. Auto-navigate to the new current month ledger.
        dispatch(setActiveLedger(currentRealWorldLedger));
      } else if (currentActiveLedger && ledgerList.length > 0) {
        // Preserve current selection: find the updated version of the active ledger
        const updatedActive = ledgerList.find(
          (l) => l._id === currentActiveLedger._id,
        );
        if (updatedActive) {
          dispatch(setActiveLedger(updatedActive));
        }
      } else if (!currentActiveLedger && ledgerList.length > 0) {
        // First load: default to current month
        dispatch(setActiveLedger(pickInitialLedger(ledgerList, now)));
      }
    } catch (error) {
      logger.error("Failed to load ledgers:", error);
    } finally {
      setLedgersFetched(true);
    }
  };

  /**
   * The report's "Where it went" opens this list filtered to one category of
   * one month. Once the ledgers are known: select that month (or search all
   * months if it has no ledger), set the filters, and clear the param so it
   * is applied once.
   */
  const ledgersReady = ledgers.length > 0 || ledgersFetched;
  useEffect(() => {
    if (!reportFilter || !ledgersReady) return;
    const { ledger, filters: next } = filtersFromReport(reportFilter, ledgers);
    if (ledger) {
      // Set before the focus's ledger load lands, or it would jump a past
      // month back to the current one.
      holdLedgerRef.current = true;
      if (ledger._id !== store.getState().expense.activeLedger?._id) {
        dispatch(setActiveLedger(ledger));
      }
    }
    setSearchOpen(false);
    setFilters(next);
    navigation.setParams({ filter: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportFilter, ledgersReady]);

  // The filter sheet's category chips: the saved list, kept current.
  useEffect(() => {
    let alive = true;
    let updated = false;
    void readSavedCategories().then((saved) => {
      // A newer copy from the listener wins over this read.
      if (alive && !updated && saved) setSavedCategories(saved.categories);
    });
    const unsubscribe = subscribeCategories((cache) => {
      updated = true;
      setSavedCategories(cache?.categories ?? []);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Offline or a server error: say so; the rows already shown stay.
  useEffect(() => {
    if (search.error) Alert.alert("Could not search", search.error);
  }, [search.error]);

  /** Hides the search bar and drops its text; the other filters stay. */
  const closeSearch = () => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setFilters((f) => (f.q ? { ...f, q: "" } : f));
  };

  const toggleSearch = () => {
    if (searchOpen) closeSearch();
    else setSearchOpen(true);
  };

  /** Back to the plain month list, which is still in memory: no request. */
  const clearFilters = () => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setFilters(EMPTY_EXPENSE_FILTERS);
  };

  const handleSearchRefresh = async () => {
    setRefreshing(true);
    await search.refresh();
    setRefreshing(false);
  };

  /**
   * Depend on the ledger ID, not the ledger OBJECT.
   *
   * `loadLedgers` dispatches `setActiveLedger` on every focus, producing a new
   * object identity even when the selected ledger has not changed — which made
   * this effect refire and refetch the whole expense list each time.
   */
  useEffect(() => {
    if (activeLedger?._id) {
      void loadExpenses(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLedger?._id]);

  const loadExpenses = async (fresh = false) => {
    if (!activeLedger) return;

    try {
      if (fresh) {
        dispatch(setTxLoading(true));

        // Load from cache first. The page is stored with its cursor; a page
        // without one never claims more, so scrolling cannot refetch page 1.
        const cached = readCachedPage(
          await cacheManager.get<unknown>(
            CACHE_KEYS.EXPENSES(activeLedger._id),
            CACHE_DURATION.EXPENSES,
          ),
        );
        if (cached) dispatch(setExpenses(cached));
      }

      const response = await getExpensesApi(
        activeLedger._id,
        fresh ? undefined : nextCursor || undefined,
        20,
      );

      const {
        expenses: newExpenses,
        nextCursor: newCursor,
        hasMore: more,
      } = response.data;

      if (fresh) {
        dispatch(
          setExpenses({
            expenses: newExpenses,
            nextCursor: newCursor,
            hasMore: more,
          }),
        );
        await cacheManager.set(CACHE_KEYS.EXPENSES(activeLedger._id), {
          expenses: newExpenses,
          nextCursor: newCursor,
          hasMore: more,
        });
      } else {
        dispatch(
          appendExpenses({
            expenses: newExpenses,
            nextCursor: newCursor,
            hasMore: more,
          }),
        );
      }
    } catch (error) {
      logger.error("Failed to load expenses:", error);
      dispatch(setTxLoading(false));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLedgers(true), loadExpenses(true)]);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore || txLoading) return;
    setLoadingMore(true);
    loadExpenses(false).finally(() => setLoadingMore(false));
  };

  const handleDelete = (expense: IExpense) => {
    const expenseId = expense._id;
    // Read now: the alert's callback runs after the user answers.
    const fromResults = filtering;
    Alert.alert(
      "Delete Expense",
      "Are you sure you want to delete this expense?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Optimistic removal, then confirm with the server. The row is
              // gone for good, so the month list drops it too if it has it.
              dispatch(removeExpense(expenseId));
              if (fromResults) search.removeLocal(expenseId);
              await deleteExpenseApi(expenseId);
              // Page 1 and the totals of the results, without the row.
              if (fromResults) void search.refresh();

              /**
               * Invalidate the cache.
               *
               * Nothing did this before, so within the 60-second TTL the
               * deleted expense was read straight back out of AsyncStorage on
               * the next visit and re-rendered — then vanished again when the
               * network response landed. A row that flickers in and out
               * destroys trust in the totals above it.
               */
              await Promise.all([
                cacheManager.remove(
                  CACHE_KEYS.EXPENSES(activeLedger?._id ?? ""),
                ),
                // A search result can be from another month.
                ...(expense.ledgerId && expense.ledgerId !== activeLedger?._id
                  ? [
                      cacheManager.remove(
                        CACHE_KEYS.EXPENSES(expense.ledgerId),
                      ),
                    ]
                  : []),
                cacheManager.remove(CACHE_KEYS.EXPENSE_LEDGERS),
                cacheManager.remove(CACHE_KEYS.EXPENSE_STATS),
              ]);

              await loadLedgers();
            } catch (error) {
              Alert.alert("Could not delete", describeError(error));
              // Roll back by refetching the authoritative list.
              void loadExpenses(true);
              if (fromResults) void search.refresh();
            }
          },
        },
      ],
    );
  };

  const handleCloseLedger = () => {
    if (!activeLedger) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Check if this is a past month
    if (
      activeLedger.year > currentYear ||
      (activeLedger.year === currentYear && activeLedger.month >= currentMonth)
    ) {
      Alert.alert(
        "Cannot Close",
        "You can only close ledgers for past months.",
      );
      return;
    }

    if (activeLedger.status === "closed") {
      Alert.alert("Already Closed", "This ledger is already closed.");
      return;
    }

    Alert.alert(
      "Close Ledger",
      `Close ledger for ${activeLedger.year}-${String(activeLedger.month).padStart(2, "0")}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await closeLedgerApi(
                activeLedger.year,
                activeLedger.month,
              );
              dispatch(updateLedger(response.data.ledger));
              Alert.alert("Success", "Ledger closed successfully");
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to close ledger",
              );
            }
          },
        },
      ],
    );
  };

  const isCurrentMonth = () => {
    if (!activeLedger) return false;
    const now = new Date();
    return (
      activeLedger.year === now.getFullYear() &&
      activeLedger.month === now.getMonth() + 1
    );
  };

  const canCloseLedger = () => {
    if (!activeLedger) return false;
    if (activeLedger.status === "closed") return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    // Can close only past months
    return (
      activeLedger.year < currentYear ||
      (activeLedger.year === currentYear && activeLedger.month < currentMonth)
    );
  };

  const renderLedgerPicker = () => {
    if (ledgers.length === 0) return null;

    return (
      <>
        <View
          style={[styles.ledgerPicker, { backgroundColor: colors.surface }]}
        >
          <Text
            style={[styles.ledgerLabel, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            Ledger period:
          </Text>
          <TouchableOpacity
            style={[
              styles.ledgerButton,
              { backgroundColor: colors.primarySurface },
            ]}
            onPress={() => setShowLedgerPicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.primary}
            />
            <Text
              style={[styles.ledgerButtonText, { color: colors.primary }]}
              numberOfLines={1}
            >
              {activeLedger
                ? `${ledgerMonthName(activeLedger)}${activeLedger.status === "closed" ? " (Closed)" : ""}`
                : "Select Ledger"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Ledger Picker Modal */}
        <Modal
          visible={showLedgerPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowLedgerPicker(false)}
        >
          <Pressable
            style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
            onPress={() => setShowLedgerPicker(false)}
          >
            <Pressable
              style={[
                styles.modalContent,
                { backgroundColor: colors.background },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Ledger Period
                </Text>
                <TouchableOpacity onPress={() => setShowLedgerPicker(false)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <FlatList
                data={[...ledgers].sort((a, b) => {
                  if (a.year !== b.year) return b.year - a.year;
                  return b.month - a.month;
                })}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                  const isActive = item._id === activeLedger?._id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.ledgerOption,
                        {
                          backgroundColor: isActive
                            ? colors.primarySurface
                            : colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => {
                        dispatch(setActiveLedger(item));
                        setShowLedgerPicker(false);
                      }}
                    >
                      <View style={styles.ledgerOptionLeft}>
                        <Ionicons
                          name="calendar"
                          size={20}
                          color={
                            isActive ? colors.primary : colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.ledgerOptionText,
                            {
                              color: isActive ? colors.primary : colors.text,
                              fontWeight: isActive ? "700" : "600",
                            },
                          ]}
                        >
                          {ledgerMonthName(item)}
                        </Text>
                      </View>
                      <View style={styles.ledgerOptionRight}>
                        {item.status === "closed" && (
                          <View
                            style={[
                              styles.closedBadge,
                              { backgroundColor: colors.textSecondary + "20" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.closedBadgeText,
                                { color: colors.textSecondary },
                              ]}
                            >
                              Closed
                            </Text>
                          </View>
                        )}
                        {isActive && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={colors.primary}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                style={styles.ledgerList}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  };

  const renderStatsBar = () => {
    if (!activeLedger) return null;

    const totalDebited = activeLedger.totalExpenses || 0;
    const totalCredited = activeLedger.totalCredits || 0;
    const net = totalCredited - totalDebited;
    const isSurplus = net >= 0;

    return (
      <View
        style={{
          backgroundColor: colors.surface,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surfaceSecondary, flex: 1 },
            ]}
          >
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Money out
            </Text>
            {/* One line that shrinks to fit: a six-figure month must not
                spill out of a half-width tile. */}
            <Text
              style={[styles.statValue, { color: colors.debit }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              ₹{formatNumber(totalDebited)}
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surfaceSecondary, flex: 1 },
            ]}
          >
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Money in
            </Text>
            <Text
              style={[styles.statValue, { color: colors.credit }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              ₹{formatNumber(totalCredited)}
            </Text>
          </View>
        </View>
        <Text
          style={{
            textAlign: "center",
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 8,
          }}
          numberOfLines={1}
        >
          Net{" "}
          <Text
            style={{
              color: isSurplus ? colors.credit : colors.debit,
              fontWeight: "600",
              fontVariant: ["tabular-nums"],
            }}
          >
            {isSurplus ? "+" : "−"}₹{formatNumber(Math.abs(net))}
          </Text>{" "}
          {isSurplus ? "surplus" : "deficit"}
        </Text>
      </View>
    );
  };

  /**
   * One row of the grouped list, rendered from `list` (the month list or the
   * search results) with `totals`, that list's day totals. The first row of
   * each day carries that day's header and totals. While the month is open,
   * a tap edits the row and a long-press deletes it (with the confirmation
   * in `handleDelete`); in a closed month the rows are read-only, as the old
   * edit/delete buttons were. Results can span months, so each result row
   * checks its own month.
   *
   * Every text is one line with an ellipsis and the amount never shrinks, so
   * a long remark or category can't push anything off the row.
   */
  const renderExpenseRow = (
    list: IExpense[],
    totals: ReturnType<typeof dayTotals>,
    expense: IExpense,
    index: number,
  ) => {
    const editable = filtering
      ? isExpenseEditable(expense, ledgers)
      : isLedgerOpen;
    const isCredit = (expense.type || "debit") === "credit";
    const category = displayCategory(expense.category);
    const { title, subtitle } = rowText(expense);
    const palette = colors.chart.categorical;
    const tint = category
      ? palette[categoryColorIndex(category, palette.length)]
      : isCredit
        ? colors.credit
        : colors.textSecondary;
    const dayKey = dayKeyOf(expense);
    const day = startsNewDay(list, index) ? totals[dayKey] : null;
    const amountText = `${isCredit ? "+" : "−"}₹${formatNumber(expense.amount)}`;

    return (
      <View>
        {day && (
          <View style={styles.dayHeader}>
            <Text
              style={[styles.dayLabel, { color: colors.text }]}
              numberOfLines={1}
            >
              {dayLabel(dayKey, todayKey)}
            </Text>
            <Text
              style={[styles.dayTotal, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {day.debit > 0 ? `−₹${formatNumber(day.debit)}` : ""}
              {day.debit > 0 && day.credit > 0 ? "  " : ""}
              {day.credit > 0 ? (
                <Text style={{ color: colors.credit }}>
                  +₹{formatNumber(day.credit)}
                </Text>
              ) : null}
            </Text>
          </View>
        )}
        <Pressable
          onPress={
            editable
              ? () => navigation.navigate("AddEditExpense", { expense })
              : undefined
          }
          onLongPress={
            editable
              ? () => {
                  void Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Medium,
                  ).catch(() => {});
                  handleDelete(expense);
                }
              : undefined
          }
          disabled={!editable}
          style={({ pressed }) => [
            styles.row,
            pressed && { backgroundColor: colors.surface },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ""}, ${amountText}`}
          accessibilityHint={
            editable
              ? "Opens the expense to edit. Long-press to delete it."
              : undefined
          }
        >
          <View
            style={[styles.avatar, { backgroundColor: withAlpha(tint, 0.16) }]}
          >
            {category ? (
              <Text style={[styles.avatarText, { color: tint }]}>
                {categoryInitial(category)}
              </Text>
            ) : (
              <Ionicons
                name={isCredit ? "arrow-down" : "wallet-outline"}
                size={18}
                color={tint}
              />
            )}
          </View>
          <View style={styles.rowText}>
            <Text
              style={[styles.rowTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={[styles.rowSubtitle, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.rowAmount,
              { color: isCredit ? colors.credit : colors.text },
            ]}
            numberOfLines={1}
          >
            {amountText}
          </Text>
        </Pressable>
      </View>
    );
  };

  /** The results list when it is empty: still searching, failed, or no match. */
  const renderSearchEmpty = () => {
    if (search.loading) {
      return (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loader}
        />
      );
    }
    const failed = search.error !== null;
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name={failed ? "cloud-offline-outline" : "search-outline"}
          size={64}
          color={colors.textSecondary}
        />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {failed ? "Could not load results" : "No expenses match."}
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
          {failed ? "Pull down to try again." : "Try fewer filters."}
        </Text>
        <TouchableOpacity
          style={[
            styles.clearFiltersButton,
            { backgroundColor: colors.primarySurface },
          ]}
          onPress={clearFilters}
          accessibilityRole="button"
        >
          <Text
            style={[styles.clearFiltersText, { color: colors.primary }]}
            numberOfLines={1}
          >
            Clear filters
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            Expenses
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={toggleSearch}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Search expenses"
              accessibilityState={{ expanded: searchOpen }}
            >
              <Ionicons
                name="search-outline"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFilterSheet(true)}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Filter expenses"
              accessibilityValue={
                filterCount > 0 ? { text: `${filterCount} active` } : undefined
              }
            >
              <Ionicons
                name="options-outline"
                size={24}
                color={colors.primary}
              />
              {filterCount > 0 && (
                <View
                  style={[
                    styles.filterDot,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.surface,
                    },
                  ]}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("ExpenseStats")}
              style={styles.headerButton}
            >
              <Ionicons
                name="stats-chart-outline"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("AccountHome")}
              activeOpacity={0.8}
            >
              <Avatar uri={user?.avatar} name={user?.name || "U"} size={40} />
            </TouchableOpacity>
          </View>
        </View>

        {renderLedgerPicker()}
        {renderStatsBar()}

        {/* Close Ledger Button */}
        {canCloseLedger() && (
          <TouchableOpacity
            style={[
              styles.closeLedgerButton,
              { backgroundColor: colors.primarySurface },
            ]}
            onPress={handleCloseLedger}
          >
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.closeLedgerText, { color: colors.primary }]}>
              Close Ledger
            </Text>
          </TouchableOpacity>
        )}

        {searchOpen && (
          <ExpenseSearchBar
            value={filters.q}
            onChangeText={(q) => setFilters((f) => ({ ...f, q }))}
            onClose={closeSearch}
            autoFocus
          />
        )}
        {filtering && (
          <ActiveFilterRow
            chips={activeChips(filters, monthName)}
            onRemove={(key) => setFilters((f) => removeChip(f, key))}
            onClearAll={clearFilters}
            summary={search.summary}
            loading={search.loading}
          />
        )}

        {/* Expense List: the search results while filtering */}
        <FlatList
          data={listData}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) =>
            renderExpenseRow(listData, totalsByDay, item, index)
          }
          contentContainerStyle={{ paddingBottom: LIST_BOTTOM_SPACE }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={filtering ? handleSearchRefresh : handleRefresh}
            />
          }
          onEndReached={filtering ? search.loadMore : handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            filtering ? (
              renderSearchEmpty()
            ) : txLoading ? (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.loader}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="wallet-outline"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No expenses yet
                </Text>
                <Text
                  style={[styles.emptySubtext, { color: colors.textSecondary }]}
                >
                  Tap the + button to add your first expense
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            (filtering ? search.loadingMore : loadingMore) ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.loader}
              />
            ) : null
          }
        />

        {/* FAB - Show for current month (even if no ledger exists) */}
        {(!activeLedger ||
          (isCurrentMonth() && activeLedger?.status === "open")) && (
          <TouchableOpacity
            style={[
              styles.fab,
              { backgroundColor: colors.primary, shadowColor: colors.shadow },
            ]}
            onPress={() =>
              navigation.navigate("AddEditExpense", {
                ledgerId: activeLedger?._id,
              })
            }
          >
            <Ionicons name="add" size={28} color={ON_ACCENT} />
          </TouchableOpacity>
        )}

        <ExpenseFilterSheet
          visible={showFilterSheet}
          initial={filters}
          categories={savedCategories}
          monthName={monthName}
          onApply={setFilters}
          onClose={() => setShowFilterSheet(false)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  // The title gives way first, so the four header actions always fit.
  title: { flexShrink: 1, fontSize: 20, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerButton: { padding: 4 },
  // Marks the filter icon while any filter is set.
  filterDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  ledgerPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  // On a narrow screen the label ellipsizes; the month button keeps its size.
  ledgerLabel: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  ledgerButton: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ledgerButtonText: { fontSize: 14, fontWeight: "600" },
  statsBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  statLabel: { fontSize: 12, fontWeight: "600" },
  statValue: {
    alignSelf: "stretch",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  closeLedgerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    justifyContent: "center",
  },
  closeLedgerText: { fontSize: 14, fontWeight: "600" },
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  dayLabel: { flexShrink: 1, fontSize: 13, fontWeight: "700" },
  dayTotal: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "700" },
  // minWidth 0 lets the text column shrink and ellipsize instead of pushing
  // the amount off the row.
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "500" },
  rowSubtitle: { fontSize: 12, marginTop: 2 },
  rowAmount: {
    flexShrink: 0,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 16, marginTop: 12 },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearFiltersText: { fontSize: 14, fontWeight: "600" },
  loader: { marginVertical: 20 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  ledgerList: { paddingHorizontal: 16, paddingTop: 8 },
  ledgerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  ledgerOptionLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  ledgerOptionText: { fontSize: 16 },
  ledgerOptionRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  closedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closedBadgeText: { fontSize: 11, fontWeight: "600" },
});

export default ExpenseScreen;
