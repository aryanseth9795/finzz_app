import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAppSelector, useAppDispatch } from "../../store";
import { setStats } from "../../store/slices/expenseSlice";
import { getExpenseStatsApi } from "../../api/expenseApi";
import { IExpenseStats } from "../../types";

const ExpenseStatsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const dispatch = useAppDispatch();

  const stats = useAppSelector((state) => state.expense.stats);
  const [period, setPeriod] = useState<"daily" | "monthly" | "yearly">(
    "monthly",
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await getExpenseStatsApi(period);
      dispatch(setStats(response.data.stats));
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {["daily", "monthly", "yearly"].map((p) => (
        <TouchableOpacity
          key={p}
          style={[
            styles.periodButton,
            {
              backgroundColor: period === p ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setPeriod(p as any)}
        >
          <Text
            style={[
              styles.periodButtonText,
              { color: period === p ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderGrandTotal = () => (
    <View style={[styles.grandTotalCard, { backgroundColor: colors.dangerBg }]}>
      <Text style={[styles.grandTotalLabel, { color: colors.textSecondary }]}>
        Total Spent (All Time)
      </Text>
      <Text style={[styles.grandTotalValue, { color: colors.danger }]}>
        ₹{stats?.grandTotal?.toFixed(2) || "0.00"}
      </Text>
    </View>
  );

  const renderStatsList = () => {
    if (!stats) return null;

    let dataList: Array<{ label: string; total: number; count: number }> = [];

    if (period === "daily" && stats.daily) {
      dataList = stats.daily.map((d) => ({
        label: d.date,
        total: d.total,
        count: d.count,
      }));
    } else if (period === "monthly" && stats.monthly) {
      dataList = stats.monthly.map((m) => ({
        label: m.month,
        total: m.total,
        count: m.count,
      }));
    } else if (period === "yearly" && stats.yearly) {
      dataList = stats.yearly.map((y) => ({
        label: y.year.toString(),
        total: y.total,
        count: y.count,
      }));
    }

    if (dataList.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="bar-chart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No data for this period
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.statsList}>
        {dataList.map((item, index) => (
          <View
            key={index}
            style={[
              styles.statsRow,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.statsLabel}>
              <Text style={[styles.statsLabelText, { color: colors.text }]}>
                {item.label}
              </Text>
              <Text
                style={[styles.statsCount, { color: colors.textSecondary }]}
              >
                {item.count} {item.count === 1 ? "expense" : "expenses"}
              </Text>
            </View>
            <Text style={[styles.statsValue, { color: colors.danger }]}>
              ₹{item.total.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          Expense Statistics
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {renderGrandTotal()}
        {renderPeriodSelector()}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : (
          renderStatsList()
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700" },
  content: { flex: 1, padding: 16 },
  grandTotalCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  grandTotalLabel: { fontSize: 14, fontWeight: "600" },
  grandTotalValue: { fontSize: 36, fontWeight: "700", marginTop: 8 },
  periodSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  periodButtonText: { fontSize: 14, fontWeight: "600" },
  statsList: { gap: 8 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    borderBottomWidth: 1,
  },
  statsLabel: { flex: 1 },
  statsLabelText: { fontSize: 16, fontWeight: "600" },
  statsCount: { fontSize: 12, marginTop: 4 },
  statsValue: { fontSize: 18, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 16, marginTop: 12 },
  loader: { marginVertical: 20 },
});

export default ExpenseStatsScreen;
