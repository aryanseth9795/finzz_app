import React, { useEffect, useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper } from "../../components/ui";
import { useAppDispatch, useAppSelector } from "../../store";
import {
  setActivePool,
  setPoolTransactions,
  setPoolTxLoading,
  appendPoolTransactions,
  resetPool,
} from "../../store/slices/poolSlice";
import {
  getPoolByIdApi,
  getPoolTxnsApi,
  verifyPoolTxApi,
  getPoolStatsApi,
} from "../../api/poolApi";
import { describeError } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import { refId, refName } from "../../utils/entities";
import { formatCurrency } from "../../utils/money";
import { formatDate } from "../../utils/dates";
import { IPoolTx, IPoolStats } from "../../types";

const PoolChatScreen = ({ route, navigation }: any) => {
  const { poolId } = route.params;
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();
  const { activePool, transactions, txLoading, nextCursor, hasMore } =
    useAppSelector((state) => state.pool);
  const userId = useAppSelector((state) => state.auth.user?._id);
  const { showSuccessToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Pool totals come from the SERVER, not from the loaded page.
   *
   * THE BUG THIS FIXES
   * The header's CREDITED / DEBITED / NET BALANCE figures were computed as:
   *
   *     transactions.filter(tx => tx.type === "credit")
   *                 .reduce((sum, tx) => sum + tx.amount, 0)
   *
   * `transactions` is the cursor-paginated page set currently in Redux, not
   * the pool. So the first render summed only page one, and the "balance"
   * climbed as the user scrolled and more pages were appended. Two members
   * who had scrolled different amounts saw different balances for the same
   * pool — the primary figure of a shared-money feature, arithmetically wrong
   * for any pool with more than one page.
   *
   * `getPoolStatsApi` already returned server-computed totals over the whole
   * pool, and PoolStatsScreen already used it correctly. This screen simply
   * did not.
   */
  const [stats, setStats] = useState<IPoolStats | null>(null);

  const totalCredited = stats?.totalCredited ?? 0;
  const totalDebited = stats?.totalDebited ?? 0;
  const netBalance = stats?.netBalance ?? 0;

  const fetchPool = useCallback(async () => {
    try {
      const res = await getPoolByIdApi(poolId);
      if (res.data.success) {
        dispatch(setActivePool(res.data.pool));
        setLoadError(null);
      }
    } catch (error) {
      /**
       * Do NOT navigate away.
       *
       * This catch previously ended in `navigation.goBack()`, and
       * `handleRefresh` calls it — so a transient timeout during pull-to-refresh
       * ejected the user from the pool mid-gesture. A 404 means the pool is
       * genuinely gone; anything else means try again.
       */
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404 || status === 403) {
        Alert.alert("Pool unavailable", "This pool no longer exists.");
        navigation.goBack();
        return;
      }
      setLoadError(describeError(error));
    }
  }, [poolId, dispatch, navigation]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getPoolStatsApi(poolId);
      if (res.data.success) setStats(res.data.stats);
    } catch {
      // Totals are supplementary; the ledger below is still usable without them.
    }
  }, [poolId]);

  const fetchTransactions = useCallback(
    async (cursor?: string) => {
      try {
        dispatch(setPoolTxLoading(true));
        const res = await getPoolTxnsApi(poolId, cursor);
        if (res.data.success) {
          if (cursor) {
            dispatch(appendPoolTransactions(res.data));
          } else {
            dispatch(setPoolTransactions(res.data));
          }
          setLoadError(null);
        }
      } catch (error) {
        setLoadError(describeError(error));
      } finally {
        dispatch(setPoolTxLoading(false));
      }
    },
    [poolId, dispatch],
  );

  // Reset on unmount so a different pool never renders with this one's rows.
  useEffect(() => () => { dispatch(resetPool()); }, [dispatch, poolId]);

  /**
   * One fetch trigger, not two.
   *
   * A mount `useEffect` AND a `useFocusEffect` both fired during the initial
   * mount, so opening a pool issued four requests where two suffice.
   * `useFocusEffect` alone covers both cases: it runs on mount and on every
   * subsequent focus.
   */
  useFocusEffect(
    useCallback(() => {
      void fetchPool();
      void fetchStats();
      void fetchTransactions();
    }, [fetchPool, fetchStats, fetchTransactions]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPool(), fetchStats(), fetchTransactions()]);
    setRefreshing(false);
  };

  const handleVerify = async (txnId: string) => {
    try {
      await verifyPoolTxApi(txnId);
      // Refresh the totals too — verifying changes what the server reports.
      await Promise.all([fetchTransactions(), fetchStats()]);
      showSuccessToast("Transaction verified!");
    } catch (error) {
      Alert.alert("Could not verify", describeError(error));
    }
  };

  const renderStatsBar = () => (
    <View style={styles.statsContainer}>
      <View
        style={[
          styles.statsCard,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.separator,
          },
        ]}
      >
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statLabel,
                { color: colors.textSecondary, fontSize: 10 },
              ]}
            >
              CREDITED
            </Text>
            <Text
              style={[
                styles.statValue,
                { color: colors.primary, fontSize: fs.lg },
              ]}
            >
              ₹{totalCredited.toLocaleString("en-IN")}
            </Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: colors.separator }]}
          />
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statLabel,
                { color: colors.textSecondary, fontSize: 10 },
              ]}
            >
              DEBITED
            </Text>
            <Text
              style={[
                styles.statValue,
                { color: colors.danger, fontSize: fs.lg },
              ]}
            >
              ₹{totalDebited.toLocaleString("en-IN")}
            </Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: colors.separator }]}
          />
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statLabel,
                { color: colors.textSecondary, fontSize: 10 },
              ]}
            >
              NET BALANCE
            </Text>
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    netBalance > 0
                      ? colors.primary
                      : netBalance < 0
                        ? colors.danger
                        : colors.text,
                  fontSize: fs.lg,
                },
              ]}
            >
              ₹{Math.abs(netBalance).toLocaleString("en-IN")}
            </Text>
            <Text
              style={[
                styles.statSubtext,
                {
                  color:
                    netBalance > 0
                      ? colors.primary
                      : netBalance < 0
                        ? colors.danger
                        : colors.textSecondary,
                  fontSize: 9,
                },
              ]}
            >
              {netBalance === 0
                ? "Settled"
                : netBalance > 0
                  ? "Surplus"
                  : "Deficit"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTableHeader = () => (
    <View
      style={[
        styles.tableHeader,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.separator,
        },
      ]}
    >
      <View style={styles.colDate}>
        <Text style={[styles.headerText, { color: colors.textSecondary }]}>
          Date
        </Text>
      </View>
      <View style={styles.colCredit}>
        <Text
          style={[
            styles.headerText,
            { color: colors.textSecondary, textAlign: "center" },
          ]}
        >
          Credit
        </Text>
      </View>
      <View style={styles.colDebit}>
        <Text
          style={[
            styles.headerText,
            { color: colors.textSecondary, textAlign: "center" },
          ]}
        >
          Debit
        </Text>
      </View>
      <View style={[styles.colStatus, { alignItems: "center" }]}>
        <Text
          style={[
            styles.headerText,
            { color: colors.textSecondary, textAlign: "center" },
          ]}
        >
          Verified
        </Text>
      </View>
    </View>
  );

  const renderTransaction = ({ item }: { item: IPoolTx }) => {
    const isCredit = item.type === "credit";
    const addedBy =
      typeof item.addedBy === "string" ? item.addedBy : item.addedBy.name;
    const verifiedBy =
      typeof item.verifiedBy === "string"
        ? item.verifiedBy
        : item.verifiedBy?.name;

    const canVerify =
      !item.verified &&
      ((typeof item.addedBy === "string" && item.addedBy !== userId) ||
        (typeof item.addedBy === "object" && item.addedBy._id !== userId));

    return (
      <View
        style={[styles.tableRow, { borderBottomColor: colors.separatorLight }]}
      >
        {/* Main Row: Date | Credit | Debit | Status */}
        <View style={styles.rowMain}>
          <View style={styles.colDate}>
            <Text style={[styles.rowText, { color: colors.text }]}>
              {new Date(item.date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
              })}
            </Text>
          </View>

          <View style={styles.colCredit}>
            <Text
              style={[
                styles.rowText,
                { color: colors.primary, textAlign: "center" },
              ]}
            >
              {isCredit ? `₹${item.amount.toLocaleString("en-IN")}` : "-"}
            </Text>
          </View>

          <View style={styles.colDebit}>
            <Text
              style={[
                styles.rowText,
                { color: colors.danger, textAlign: "center" },
              ]}
            >
              {!isCredit ? `₹${item.amount.toLocaleString("en-IN")}` : "-"}
            </Text>
          </View>

          <View style={[styles.colStatus, { alignItems: "center" }]}>
            {item.verified ? (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.primary}
              />
            ) : canVerify ? (
              <TouchableOpacity
                onPress={() => handleVerify(item._id)}
                style={[
                  styles.verifyBtn,
                  { backgroundColor: colors.successLight },
                ]}
              >
                <Text style={[styles.verifyBtnText, { color: colors.success }]}>
                  Verify
                </Text>
              </TouchableOpacity>
            ) : (
              <Ionicons
                name="time-outline"
                size={18}
                color={colors.textTertiary}
              />
            )}
          </View>
        </View>

        {/* Footer Row: Remarks & Added By */}
        <View style={styles.rowFooter}>
          <Text
            style={[styles.remarksText, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.remarks || "No remarks"}
          </Text>
          <Text style={[styles.addedByText, { color: colors.textTertiary }]}>
            Added by {addedBy}
          </Text>
        </View>
      </View>
    );
  };

  const isAdmin = activePool?.admin._id === userId;
  const isClosed = activePool?.status === "closed";

  return (
    <SafeAreaWrapper edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.text, fontSize: fs.lg },
            ]}
            numberOfLines={1}
          >
            {activePool?.name || "Pool"}
          </Text>
          {activePool && (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    activePool.status === "active"
                      ? colors.primarySurface
                      : colors.textSecondary + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      activePool.status === "active"
                        ? colors.primary
                        : colors.textSecondary,
                    fontSize: 10,
                  },
                ]}
              >
                {activePool.status.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.settingsButton,
            { backgroundColor: colors.primarySurface },
          ]}
          onPress={() => navigation.navigate("PoolSettings", { poolId })}
        >
          <Ionicons name="settings-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      {renderStatsBar()}

      {/* Transaction Table */}
      {txLoading && transactions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.tableContainer}>
          {renderTableHeader()}
          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="receipt-outline"
                  size={48}
                  color={colors.textTertiary}
                />
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.textTertiary, fontSize: fs.md },
                  ]}
                >
                  No transactions yet
                </Text>
                <Text
                  style={[
                    styles.emptySubtext,
                    { color: colors.textTertiary, fontSize: fs.sm },
                  ]}
                >
                  Tap + to add the first one
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            onEndReached={() => {
              if (hasMore && !txLoading && nextCursor) {
                fetchTransactions(nextCursor);
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              txLoading && transactions.length > 0 ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ paddingVertical: 20 }}
                />
              ) : null
            }
            contentContainerStyle={
              transactions.length === 0
                ? styles.emptyList
                : { paddingBottom: 100 }
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* FAB */}
      {!isClosed && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() =>
            navigation.navigate("AddEditPoolTx", { poolId, mode: "add" })
          }
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    marginLeft: -8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // Stats
  statsContainer: {
    marginBottom: 7,
  },
  statsCard: {
    marginHorizontal: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 8,
  },
  statLabel: {
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statValue: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statSubtext: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Table
  tableContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    paddingHorizontal: 6,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  colDate: { flex: 2 },
  colCredit: { flex: 2 },
  colDebit: { flex: 2 },
  colStatus: { flex: 1.5 },
  tableRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowText: {
    fontSize: 13,
    fontWeight: "600",
  },
  rowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  remarksText: {
    fontSize: 11,
    flex: 1,
    fontWeight: "400",
  },
  addedByText: {
    fontSize: 10,
    fontWeight: "500",
    marginLeft: 8,
  },
  verifyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifyBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  // Empty
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontWeight: "600",
  },
  emptySubtext: {
    fontWeight: "400",
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  // FAB
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

export default PoolChatScreen;
