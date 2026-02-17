import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../../components/ui";
import { useTheme } from "../../contexts/ThemeContext";
import { useAppSelector, useAppDispatch } from "../../store";
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
import { IExpense, IExpenseLedger } from "../../types";
import { cacheManager, CACHE_KEYS } from "../../utils/cacheManager";
import { CACHE_DURATION } from "../../constants/api";

const ExpenseScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius, fontSize, fontWeight } = theme;
  const dispatch = useAppDispatch();

  const { expenses, ledgers, activeLedger, txLoading, nextCursor, hasMore } =
    useAppSelector((state) => state.expense);
  const user = useAppSelector((state) => state.auth.user);

  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Initialize: Load ledgers and set active to current month
  useEffect(() => {
    loadLedgers();
  }, []);

  // Listen for refresh trigger from child screens
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      // Reload ledgers when screen comes into focus
      loadLedgers();
    });
    return unsubscribe;
  }, [navigation]);

  const loadLedgers = async () => {
    try {
      const cached = await cacheManager.get<IExpenseLedger[]>(
        CACHE_KEYS.EXPENSE_LEDGERS,
        CACHE_DURATION.EXPENSES,
      );
      if (cached) dispatch(setLedgers(cached));

      const response = await getExpenseLedgersApi();
      const ledgerList: IExpenseLedger[] = response.data.ledgers;

      dispatch(setLedgers(ledgerList));
      await cacheManager.set(CACHE_KEYS.EXPENSE_LEDGERS, ledgerList);

      // Set active ledger to current month if not set
      if (!activeLedger && ledgerList.length > 0) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const current = ledgerList.find(
          (l) => l.year === currentYear && l.month === currentMonth,
        );
        dispatch(setActiveLedger(current || ledgerList[0]));
      }
    } catch (error) {
      console.error("Failed to load ledgers:", error);
    }
  };

  // Load expenses when active ledger changes
  useEffect(() => {
    if (activeLedger) {
      loadExpenses(true);
    }
  }, [activeLedger]);

  const loadExpenses = async (fresh = false) => {
    if (!activeLedger) return;

    try {
      if (fresh) {
        dispatch(setTxLoading(true));

        // Load from cache first
        const cached = await cacheManager.get<IExpense[]>(
          CACHE_KEYS.EXPENSES(activeLedger._id),
          CACHE_DURATION.EXPENSES,
        );
        if (cached) {
          dispatch(
            setExpenses({ expenses: cached, nextCursor: null, hasMore: true }),
          );
        }
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
        await cacheManager.set(
          CACHE_KEYS.EXPENSES(activeLedger._id),
          newExpenses,
        );
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
      console.error("Failed to load expenses:", error);
      dispatch(setTxLoading(false));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLedgers(), loadExpenses(true)]);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore || txLoading) return;
    setLoadingMore(true);
    loadExpenses(false).finally(() => setLoadingMore(false));
  };

  const handleDelete = (expenseId: string) => {
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
              // Optimistic update
              dispatch(removeExpense(expenseId));

              // Call server
              await deleteExpenseApi(expenseId);

              // Refresh ledger to get updated total
              await loadLedgers();
            } catch (error: any) {
              console.error("Failed to delete expense:", error);
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to delete expense",
              );
              // Rollback: reload
              loadExpenses(true);
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
      <View style={[styles.ledgerPicker, { backgroundColor: colors.surface }]}>
        <Text style={[styles.ledgerLabel, { color: colors.textSecondary }]}>
          Ledger Period:
        </Text>
        <TouchableOpacity
          style={[
            styles.ledgerButton,
            { backgroundColor: colors.primarySurface },
          ]}
          onPress={() => {
            // Show picker modal (for simplicity, cycling through for now)
            const currentIndex = ledgers.findIndex(
              (l) => l._id === activeLedger?._id,
            );
            const nextIndex = (currentIndex + 1) % ledgers.length;
            dispatch(setActiveLedger(ledgers[nextIndex]));
          }}
        >
          <Text style={[styles.ledgerButtonText, { color: colors.primary }]}>
            {activeLedger
              ? `${activeLedger.year}-${String(activeLedger.month).padStart(2, "0")} ${activeLedger.status === "closed" ? "(Closed)" : ""}`
              : "Select Ledger"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderStatsBar = () => {
    if (!activeLedger) return null;

    return (
      <View style={[styles.statsBar, { backgroundColor: colors.surface }]}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Spent
          </Text>
          <Text style={[styles.statValue, { color: colors.danger }]}>
            ₹{activeLedger.totalExpenses.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surface }]}>
      <Text
        style={[
          styles.headerCell,
          styles.dateCell,
          { color: colors.textSecondary },
        ]}
      >
        Date
      </Text>
      <Text
        style={[
          styles.headerCell,
          styles.amountCell,
          { color: colors.textSecondary },
        ]}
      >
        Amount
      </Text>
      <Text
        style={[
          styles.headerCell,
          styles.actionsCell,
          { color: colors.textSecondary },
        ]}
      >
        Actions
      </Text>
    </View>
  );

  const renderExpenseRow = ({ item: expense }: { item: IExpense }) => (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      {/* First Line: Date, Amount, Actions */}
      <View style={styles.rowTop}>
        <Text style={[styles.cell, styles.dateCell, { color: colors.text }]}>
          {new Date(expense.date).toLocaleDateString()}
        </Text>
        <Text
          style={[styles.cell, styles.amountCell, { color: colors.danger }]}
        >
          ₹{expense.amount.toFixed(2)}
        </Text>
        <View style={styles.actionsCell}>
          {activeLedger?.status === "open" && isCurrentMonth() && (
            <>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("AddEditExpense", { expense })
                }
                style={styles.actionButton}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(expense._id)}
                style={styles.actionButton}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={colors.danger}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
      {/* Second Line: Remarks */}
      {expense.remarks && (
        <Text
          style={[styles.remarksText, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {expense.remarks}
        </Text>
      )}
    </View>
  );

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
          <Text style={[styles.title, { color: colors.text }]}>Expenses</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                if (!activeLedger) {
                  Alert.alert("No Ledger", "Please select a ledger to export");
                  return;
                }
                const {
                  generateAndSharePDF,
                } = require("../../utils/pdfExport");
                const ledgerName = `${activeLedger.year}-${String(activeLedger.month).padStart(2, "0")}`;
                generateAndSharePDF(activeLedger._id, ledgerName);
              }}
              style={styles.headerButton}
            >
              <Ionicons
                name="download-outline"
                size={24}
                color={colors.primary}
              />
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
              { backgroundColor: colors.warningLight },
            ]}
            onPress={handleCloseLedger}
          >
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color={colors.warning}
            />
            <Text style={[styles.closeLedgerText, { color: colors.warning }]}>
              Close Ledger
            </Text>
          </TouchableOpacity>
        )}

        {/* Expense List */}
        <FlatList
          data={expenses}
          keyExtractor={(item) => item._id}
          renderItem={renderExpenseRow}
          ListHeaderComponent={renderTableHeader}
          stickyHeaderIndices={[0]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            txLoading ? (
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
                  color={colors.textTertiary}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No expenses yet
                </Text>
                <Text
                  style={[styles.emptySubtext, { color: colors.textTertiary }]}
                >
                  Tap the + button to add your first expense
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? (
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
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() =>
              navigation.navigate("AddEditExpense", {
                ledgerId: activeLedger?._id,
              })
            }
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
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
  title: { fontSize: 20, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 12 },
  headerButton: { padding: 4 },
  ledgerPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  ledgerLabel: { fontSize: 14, fontWeight: "600" },
  ledgerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ledgerButtonText: { fontSize: 14, fontWeight: "600" },
  statsBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    padding: 4,
    borderRadius: 8,
    alignItems: "center",
  },
  statLabel: { fontSize: 12, fontWeight: "600" },
  statValue: { fontSize: 24, fontWeight: "700", marginTop: 4 },
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
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderTopWidth: 1,
  },
  headerCell: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cell: { fontSize: 14 },
  dateCell: { fontWeight: "600", minWidth: 80 },
  amountCell: { fontWeight: "700", minWidth: 90 },
  actionsCell: {
    flexDirection: "row",
    gap: 8,
    minWidth: 60,
    justifyContent: "flex-end",
  },
  actionButton: { padding: 4 },
  remarksText: {
    fontSize: 13,
    marginTop: 6,
    paddingLeft: 0,
    fontStyle: "italic",
  },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 16, marginTop: 12 },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default ExpenseScreen;
