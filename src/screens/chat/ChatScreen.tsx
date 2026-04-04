import React, { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Avatar } from "../../components/ui";
import { getTxnsApi, verifyTxApi, reviewTxApi, deleteTxApi } from "../../api/txApi";
import { getChatStatsApi, getChatMonthsApi, getChatExportHtmlApi } from "../../api/statsApi";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useAppSelector, useAppDispatch } from "../../store";
import {
  setTransactions,
  appendTransactions,
  setStats,
  setTxLoading,
  removeTx,
  updateTx,
} from "../../store/slices/chatSlice";
import { cacheManager, CACHE_KEYS } from "../../utils/cacheManager";
import { CACHE_DURATION } from "../../constants/api";
import { ITx, IChatStats, IUser, IAvailableMonth } from "../../types";

const ChatScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs, borderRadius: br } = theme;
  const dispatch = useAppDispatch();
  const { chatId, chat } = route.params;

  const { transactions, stats, txLoading, nextCursor, hasMore } =
    useAppSelector((state) => state.chat);
  const { user } = useAppSelector((state) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Month picker state
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [availableMonths, setAvailableMonths] = useState<IAvailableMonth[]>([]);

  // Rejection modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTxnId, setRejectTxnId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Get friend info
  const friend: IUser =
    chat?.members?.find((m: IUser) => m._id !== user?._id) ||
    chat?.members?.[0];

  const fetchTransactions = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) dispatch(setTxLoading(true));

        // Try cache first for initial load
        if (!isRefresh) {
          const cached = await cacheManager.get<{
            txns: ITx[];
            nextCursor: string | null;
            hasMore: boolean;
          }>(
            CACHE_KEYS.TRANSACTIONS(chatId, selectedYear, selectedMonth),
            CACHE_DURATION.TRANSACTIONS,
          );
          if (cached) {
            dispatch(setTransactions(cached));
          }
        }

        const response = await getTxnsApi(
          chatId,
          undefined,
          selectedYear,
          selectedMonth,
        );
        const data = response.data;
        dispatch(
          setTransactions({
            txns: data.txns || data,
            nextCursor: data.nextCursor || null,
            hasMore: data.hasMore ?? false,
          }),
        );
        await cacheManager.set(
          CACHE_KEYS.TRANSACTIONS(chatId, selectedYear, selectedMonth),
          {
            txns: data.txns || data,
            nextCursor: data.nextCursor || null,
            hasMore: data.hasMore ?? false,
          },
        );
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        dispatch(setTxLoading(false));
      }
    },
    [chatId, dispatch, selectedYear, selectedMonth],
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await getChatStatsApi(
        chatId,
        selectedYear,
        selectedMonth,
      );
      const backendStats = response.data.stats;
      dispatch(setStats(backendStats));
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [chatId, dispatch, selectedYear, selectedMonth]);

  const fetchAvailableMonths = useCallback(async () => {
    try {
      const response = await getChatMonthsApi(chatId);
      const months: IAvailableMonth[] = response.data.months || [];
      setAvailableMonths(months);
      // Ensure current month is always in the list
      const now = new Date();
      const hasCurrentMonth = months.some(
        (m) => m.year === now.getFullYear() && m.month === now.getMonth() + 1,
      );
      if (!hasCurrentMonth) {
        setAvailableMonths([
          { year: now.getFullYear(), month: now.getMonth() + 1, txCount: 0 },
          ...months,
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch months:", error);
    }
  }, [chatId]);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
    fetchAvailableMonths();
  }, [fetchTransactions, fetchStats, fetchAvailableMonths]);

  // Re-fetch stats when month changes
  useEffect(() => {
    fetchStats();
  }, [selectedYear, selectedMonth, fetchStats]);

  // Refresh data when screen comes into focus (e.g., after adding a transaction)
  useFocusEffect(
    useCallback(() => {
      fetchTransactions(true);
      fetchStats();
    }, [fetchTransactions, fetchStats]),
  );

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const response = await getTxnsApi(
        chatId,
        nextCursor,
        selectedYear,
        selectedMonth,
      );
      const data = response.data;
      dispatch(
        appendTransactions({
          txns: data.txns || data,
          nextCursor: data.nextCursor || null,
          hasMore: data.hasMore ?? false,
        }),
      );
    } catch (error) {
      console.error("Failed to load more:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const invalidateChatCache = async () => {
    await cacheManager.removeByPrefix(CACHE_KEYS.TRANSACTIONS_PREFIX(chatId));
    await cacheManager.remove(CACHE_KEYS.CHAT_STATS(chatId));
    await cacheManager.remove(CACHE_KEYS.CHATS);
  };

  const handleVerify = async (txnId: string) => {
    try {
      const response = await reviewTxApi(txnId, "verify");
      dispatch(updateTx(response.data.txn));
      await invalidateChatCache();
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || "Failed to verify");
    }
  };

  const handleReject = async (txnId: string) => {
    // Open the rejection modal instead of rejecting immediately
    setRejectTxnId(txnId);
    setRejectRemark("");
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectTxnId) return;
    setRejecting(true);
    try {
      const response = await reviewTxApi(
        rejectTxnId,
        "reject",
        rejectRemark.trim() || undefined,
      );
      dispatch(updateTx(response.data.txn));
      await invalidateChatCache();
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || "Failed to reject");
    } finally {
      setRejecting(false);
      setRejectModalVisible(false);
      setRejectTxnId(null);
      setRejectRemark("");
    }
  };

  const handleDownloadReport = async () => {
    try {
      const response = await getChatExportHtmlApi(chatId, selectedYear, selectedMonth);
      const html = response.data?.html;
      if (!html) throw new Error("No HTML returned from server");

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to generate PDF report");
      console.error(error);
    }
  };

  const handleDelete = (txnId: string) => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this rejected transaction?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTxApi(txnId);
              dispatch(removeTx(txnId));
              await invalidateChatCache();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error?.response?.data?.message || "Failed to delete",
              );
            }
          },
        },
      ],
    );
  };

  // Helper to get user name
  const getUserName = (userId?: string | { _id: string; name: string }) => {
    if (!userId) return "-";

    // If it's a populated object, return the name directly
    if (typeof userId === "object" && "name" in userId) {
      return userId.name;
    }

    // At this point, TypeScript knows userId is a string
    if (userId === user?._id) return "You";

    // Check members
    const member = chat?.members?.find((m: IUser) => m._id === userId);
    if (member) return member.name;

    // If not found in members, check if it's the friend from transaction
    if (friend && friend._id === userId) return friend.name;

    return "Unknown";
  };

  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTransactions(true),
      fetchStats(),
      fetchAvailableMonths(),
    ]);
    setRefreshing(false);
  };

  const renderMonthPicker = () => {
    if (!availableMonths || availableMonths.length === 0) return null;

    // Sort months: newest first
    const sortedMonths = [...availableMonths].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    return (
      <View
        style={[
          styles.monthPickerContainer,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.separator,
          },
        ]}
      >
        <Text
          style={[
            styles.monthPickerLabel,
            { color: colors.textSecondary, fontSize: fs.xs },
          ]}
        >
          Month:
        </Text>
        <Picker
          selectedValue={`${selectedYear}-${selectedMonth}`}
          onValueChange={(itemValue) => {
            const [year, month] = itemValue.split("-");
            setSelectedYear(parseInt(year));
            setSelectedMonth(parseInt(month));
          }}
          style={[styles.picker, { color: colors.text }]}
          dropdownIconColor={colors.text}
        >
          {sortedMonths.map((m) => (
            <Picker.Item
              key={`${m.year}-${m.month}`}
              label={`${MONTH_NAMES[m.month - 1]} ${m.year}`}
              value={`${m.year}-${m.month}`}
            />
          ))}
        </Picker>
      </View>
    );
  };

  const renderStatsBar = () => {
    if (!stats?.members || !user?._id) return null;

    const myStats = stats.members[user._id];
    if (!myStats) return null;

    // Backend carryForward = Received - Sent (Positive = You Owe)
    // We want Positive = You Receive (Sent - Received)
    // So we subtract the backend carryForward.
    const carryForward = stats.carryForward?.[user._id] || 0;
    const currentMonthNet = myStats.totalSent - myStats.totalReceived;
    const totalNet = currentMonthNet - carryForward;

    return (
      <View style={styles.statsContainer}>
        <View
          style={[
            styles.singleStatCard,
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
                  styles.statItemLabel,
                  { color: colors.textSecondary, fontSize: 10 },
                ]}
              >
                Sent (This Month)
              </Text>
              <Text
                style={[
                  styles.statItemValue,
                  { color: colors.debit, fontSize: fs.lg },
                ]}
              >
                ₹{myStats.totalSent.toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statItemLabel,
                  { color: colors.textSecondary, fontSize: 10 },
                ]}
              >
                Received (This Month)
              </Text>
              <Text
                style={[
                  styles.statItemValue,
                  { color: colors.credit, fontSize: fs.lg },
                ]}
              >
                ₹{myStats.totalReceived.toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statItemLabel,
                  { color: colors.textSecondary, fontSize: 10 },
                ]}
              >
                Total
              </Text>
              <Text
                style={[
                  styles.statItemValue,
                  {
                    color:
                      totalNet > 0
                        ? colors.credit
                        : totalNet < 0
                          ? colors.debit
                          : colors.text,
                    fontSize: fs.lg,
                  },
                ]}
              >
                ₹{Math.abs(totalNet).toLocaleString("en-IN")}
              </Text>
              <Text
                style={[
                  styles.statItemSubtext,
                  {
                    color:
                      totalNet > 0
                        ? colors.credit
                        : totalNet < 0
                          ? colors.debit
                          : colors.textSecondary,
                    fontSize: 9,
                  },
                ]}
              >
                {totalNet === 0
                  ? "Settled"
                  : totalNet > 0
                    ? "To receive"
                    : "To pay"}
              </Text>
            </View>
          </View>
        </View>

        {/* Download Report Button */}
        <TouchableOpacity
          onPress={handleDownloadReport}
          style={[
            styles.downloadBtn,
            { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={[styles.downloadBtnText, { color: colors.primary }]}>
            Download Report
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

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
      <View style={styles.colAmount}>
        <Text
          style={[
            styles.headerText,
            { color: colors.textSecondary, textAlign: "center" },
          ]}
        >
          Gave
        </Text>
      </View>
      <View style={styles.colAmount}>
        <Text
          style={[
            styles.headerText,
            { color: colors.textSecondary, textAlign: "center" },
          ]}
        >
          Received
        </Text>
      </View>
      <View style={[styles.colStatus, { alignItems: "center" }]}>
        <Text
          style={[
            styles.headerText,
            { color: colors.textSecondary, textAlign: "center" },
          ]}
        >
          Status
        </Text>
      </View>
    </View>
  );

  const renderTxRow = ({ item: tx }: { item: ITx }) => {
    const getUserId = (u?: string | { _id: string; name: string }) => {
      if (!u) return undefined;
      if (typeof u === "string") return u;
      return u._id;
    };

    const txStatus = tx.status || (tx.verified ? "verified" : "pending");
    const isCarryForward = tx._id === "carry-forward";
    const isCredit = getUserId(tx.to) === user?._id;
    const addedById = getUserId(tx.addedBy);
    const isMyTx = addedById === user?._id;

    // Action rules based on status
    const isReceiverPending = !isMyTx && txStatus === "pending";
    const isCreatorRejected = isMyTx && txStatus === "rejected";
    const addedByName = getUserName(tx.addedBy);

    const rowBg =
      txStatus === "rejected"
        ? colors.danger + "10"
        : isCarryForward
          ? colors.surfaceSecondary + "40"
          : undefined;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() =>
          isCreatorRejected ? handleDelete(tx._id) : null
        }
        onPress={() =>
          isCreatorRejected
            ? navigation.navigate("AddEditTx", {
                chatId,
                tx,
                friendName: friend?.name,
                friend,
              })
            : null
        }
        style={[
          styles.tableRow,
          { borderBottomColor: colors.separatorLight },
          rowBg ? { backgroundColor: rowBg } : null,
        ]}
      >
        {/* Main Row */}
        <View style={styles.rowMain}>
          <View style={styles.colDate}>
            <Text style={[styles.rowText, { color: colors.text }]}>
              {isCarryForward ? "Past" : dayjs(tx.date).format("DD/MM/YY")}
            </Text>
          </View>

          <View style={styles.colAmount}>
            <Text style={[styles.rowText, { color: colors.debit, textAlign: "center" }]}>
              {!isCredit ? `₹${tx.amount.toLocaleString("en-IN")}` : "-"}
            </Text>
          </View>

          <View style={styles.colAmount}>
            <Text style={[styles.rowText, { color: colors.credit, textAlign: "center" }]}>
              {isCredit ? `₹${tx.amount.toLocaleString("en-IN")}` : "-"}
            </Text>
          </View>

          {/* Status column */}
          <View style={[styles.colStatus, { alignItems: "center" }]}>
            {isCarryForward ? (
              <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} />
            ) : txStatus === "verified" ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.verified} />
            ) : txStatus === "rejected" ? (
              <Ionicons name="close-circle" size={16} color={colors.danger} />
            ) : isReceiverPending ? (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => handleVerify(tx._id)}
                  style={[styles.verifyBtn, { backgroundColor: colors.successLight }]}
                >
                  <Text style={[styles.verifyBtnText, { color: colors.verified }]}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleReject(tx._id)}
                  style={[styles.verifyBtn, { backgroundColor: colors.danger + "20" }]}
                >
                  <Text style={[styles.verifyBtnText, { color: colors.danger }]}>✗</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Ionicons name="time-outline" size={18} color={colors.textTertiary} />
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.rowFooter}>
          <Text style={[styles.remarksText, { color: colors.textSecondary }]} numberOfLines={2}>
            {txStatus === "rejected"
              ? `Rejected${tx.rejectionRemark ? ` — "${tx.rejectionRemark}"` : ""}`
              : (tx.remarks || "No remarks")}
          </Text>
          {!isCarryForward && txStatus !== "rejected" && (
            <Text style={[styles.addedByText, { color: colors.textTertiary }]}>
              By {addedByName}
            </Text>
          )}
        </View>

        {/* Action buttons for creator on rejected txns */}
        {isCreatorRejected && (
          <View style={styles.rejectedActions}>
            <TouchableOpacity
              style={[styles.rejActBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
              onPress={() =>
                navigation.navigate("AddEditTx", {
                  chatId,
                  tx,
                  friendName: friend?.name,
                  friend,
                })
              }
            >
              <Ionicons name="create-outline" size={14} color={colors.primary} />
              <Text style={[styles.rejActBtnText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejActBtn, { backgroundColor: colors.danger + "12", borderColor: colors.danger + "30" }]}
              onPress={() => handleDelete(tx._id)}
            >
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
              <Text style={[styles.rejActBtnText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Create a display list that includes the carry forward entry at the end if needed
  const displayTransactions = [...transactions];

  if (!hasMore && !txLoading && stats?.carryForward && user?._id) {
    const carryForward = stats.carryForward[user._id] || 0;
    if (carryForward !== 0) {
      // Create a mock transaction for the carry forward
      const isCredit = carryForward > 0; // Positive carry forward means we are owed (credit)
      const carryDate =
        transactions.length > 0
          ? transactions[transactions.length - 1].date
          : new Date(selectedYear, selectedMonth - 1, 1).toISOString();

      const carryForwardTx: ITx = {
        _id: "carry-forward",
        chatId: chatId,
        amount: Math.abs(carryForward),
        date: carryDate as any,
        to: isCredit ? (user._id as any) : friend?._id || ("" as any),
        from: isCredit ? friend?._id || ("" as any) : (user._id as any),
        remarks: "last month Accounts",
        addedBy: "system" as any,
        status: "verified" as any,
        verified: true,
        createdAt: new Date().toISOString() as any,
        updatedAt: new Date().toISOString() as any,
      };
      displayTransactions.push(carryForwardTx);
    }
  }

  return (
    <SafeAreaWrapper edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        {friend && <Avatar uri={friend.avatar} name={friend.name} size={36} />}
        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerName, { color: colors.text, fontSize: fs.lg }]}
          >
            {friend?.name || "Chat"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("Report", { chatId, friendId: friend?._id })
          }
          style={[
            styles.headerButton,
            { backgroundColor: colors.primarySurface },
          ]}
        >
          <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Month Picker */}
      {renderMonthPicker()}

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
            data={displayTransactions}
            keyExtractor={(item) => item._id}
            renderItem={renderTxRow}
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
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
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

      <TouchableOpacity
        onPress={() =>
          navigation.navigate("AddEditTx", {
            chatId,
            friendName: friend?.name,
            friend,
          })
        }
        style={[styles.fab, { backgroundColor: colors.primary }]}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Rejection Remark Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="close-circle-outline" size={24} color={colors.danger} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Reject Transaction
              </Text>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Optionally add a reason for rejection
            </Text>

            <TextInput
              style={[
                styles.remarkInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Wrong amount, not this month..."
              placeholderTextColor={colors.textTertiary}
              value={rejectRemark}
              onChangeText={setRejectRemark}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 },
                ]}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectTxnId(null);
                  setRejectRemark("");
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.danger },
                ]}
                onPress={confirmReject}
                disabled={rejecting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#FFF" }]}>
                    Reject
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    // borderBottomWidth: StyleSheet.hairlineWidth, // Cleaner header
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    marginLeft: -8,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // Month Picker
  monthPickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 4, // Reduced vertical padding since Picker has own height
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 52,
  },
  monthPickerLabel: {
    fontWeight: "600",
    marginRight: 8,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  // Single stats card
  statsContainer: {
    marginBottom: 7,
  },
  singleStatCard: {
    marginHorizontal: 16,
    // marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    // Add shadow
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
    backgroundColor: "#E2E8F0", // Slate-200
    marginHorizontal: 8,
  },
  statItemLabel: {
    fontWeight: "600",
    // marginBottom: 6,
    textAlign: "center",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statItemValue: {
    fontWeight: "800",
    // marginBottom: 2,
    letterSpacing: -0.5,
  },
  statItemSubtext: {
    fontWeight: "700",
    // marginTop: 4,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Download button in stats bar
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  // Table Styles
  tableContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    // marginTop: 8,
    paddingHorizontal: 6,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  headerText: {
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tableRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    gap: 6,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  rowText: {
    fontSize: 13,
    fontWeight: "500",
  },
  remarksText: {
    fontSize: 11,
    fontStyle: "italic",
    flex: 1,
  },
  addedByText: {
    fontSize: 10,
    marginLeft: 8,
  },
  // Responsive table columns
  colDate: { width: 70, minWidth: 60 },
  colAmount: { flex: 1, minWidth: 60, paddingRight: 4 },
  colStatus: { width: 75, minWidth: 70, alignItems: "center" },

  rejectedActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    paddingLeft: 70,
  },
  rejActBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  rejActBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },

  verifyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifyBtnText: {
    fontSize: 10,
    fontWeight: "600",
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontWeight: "500",
  },
  emptyList: {
    flexGrow: 1,
  },

  // Rejection modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  remarkInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

export default ChatScreen;
