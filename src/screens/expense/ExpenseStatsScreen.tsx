import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { useTheme } from "../../contexts/ThemeContext";
import { getAdvancedStatsApi, getExpenseExportHtmlApi } from "../../api/expenseApi";
import { IAdvancedExpenseStats } from "../../types";

const SCREEN_WIDTH = Dimensions.get("window").width;

const ExpenseStatsScreen = ({ navigation }: any) => {
  const { theme, isDark } = useTheme();
  const { colors } = theme;

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<IAdvancedExpenseStats | null>(null);

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const availableMonths = useMemo(() => {
    const months = [];
    const current = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
      });
    }
    return months;
  }, []);

  useEffect(() => {
    loadStats();
  }, [selectedDate]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await getAdvancedStatsApi(
        selectedDate.year,
        selectedDate.month,
      );
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Failed to load advanced stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!stats?.selectedLedger?._id) {
      Alert.alert(
        "No Data",
        "No ledger found for this month. Add some expenses first.",
      );
      return;
    }
    try {
      const response = await getExpenseExportHtmlApi(stats.selectedLedger._id);
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

  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) =>
      isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDark
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(33, 33, 33, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.6,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
  };

  const renderMonthSelector = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.monthSelector}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {availableMonths.map((m) => {
        const isSelected =
          m.year === selectedDate.year && m.month === selectedDate.month;
        return (
          <TouchableOpacity
            key={`${m.year}-${m.month}`}
            style={[
              styles.monthPill,
              isSelected && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
              { borderColor: colors.border },
            ]}
            onPress={() => setSelectedDate({ year: m.year, month: m.month })}
          >
            <Text
              style={[
                styles.monthPillText,
                isSelected
                  ? { color: "#FFF" }
                  : { color: colors.textSecondary },
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderSummaryCards = () => {
    const s = stats?.summary;
    const net = s?.net ?? 0;
    const netColor = net >= 0 ? colors.credit : colors.danger;
    const netLabel = net >= 0 ? "Surplus" : "Deficit";

    return (
      <View style={styles.summaryGrid}>
        {/* Debited */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.summaryIcon, { backgroundColor: "#FEE2E230" }]}>
            <Ionicons name="arrow-up-circle-outline" size={20} color={colors.danger} />
          </View>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Debited
          </Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]} numberOfLines={1}>
            {loading ? "..." : `₹${Math.round(s?.totalDebits ?? 0).toLocaleString()}`}
          </Text>
          <Text style={[styles.summaryCount, { color: colors.textTertiary }]}>
            {s?.debitCount ?? 0} txns
          </Text>
        </View>

        {/* Credited */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.summaryIcon, { backgroundColor: "#D1FAE530" }]}>
            <Ionicons name="arrow-down-circle-outline" size={20} color={colors.credit} />
          </View>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Credited
          </Text>
          <Text style={[styles.summaryValue, { color: colors.credit }]} numberOfLines={1}>
            {loading ? "..." : `₹${Math.round(s?.totalCredits ?? 0).toLocaleString()}`}
          </Text>
          <Text style={[styles.summaryCount, { color: colors.textTertiary }]}>
            {s?.creditCount ?? 0} txns
          </Text>
        </View>

        {/* Net */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.summaryIcon, { backgroundColor: netColor + "20" }]}>
            <Ionicons
              name={net >= 0 ? "trending-up-outline" : "trending-down-outline"}
              size={20}
              color={netColor}
            />
          </View>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            {netLabel}
          </Text>
          <Text style={[styles.summaryValue, { color: netColor }]} numberOfLines={1}>
            {loading ? "..." : `₹${Math.round(Math.abs(net)).toLocaleString()}`}
          </Text>
          <Text style={[styles.summaryCount, { color: colors.textTertiary }]}>
            {s?.activeDays ?? 0} active days
          </Text>
        </View>
      </View>
    );
  };

  const renderAvgRow = () => {
    const s = stats?.summary;
    if (!s) return null;
    return (
      <View
        style={[
          styles.avgRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.avgItem}>
          <Text style={[styles.avgLabel, { color: colors.textSecondary }]}>
            Avg Daily Debit
          </Text>
          <Text style={[styles.avgValue, { color: colors.danger }]}>
            ₹{Math.round(s.avgDailyDebit).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.avgDivider, { backgroundColor: colors.separator }]} />
        <View style={styles.avgItem}>
          <Text style={[styles.avgLabel, { color: colors.textSecondary }]}>
            Avg Daily Credit
          </Text>
          <Text style={[styles.avgValue, { color: colors.credit }]}>
            ₹{Math.round(s.avgDailyCredit).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  const renderCharts = () => {
    if (!stats || loading)
      return (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      );

    // --- Monthly Trend (last 6 months, debit bars) ---
    const trend = stats.monthlyTrend.slice(-6);
    const trendLabels = trend.map((m) => {
      const [y, mo] = m.month.split("-");
      return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString(
        "en-US",
        { month: "short" },
      );
    });
    const debitTrendValues = trend.map((m) => m.debitTotal || 0);
    const creditTrendValues = trend.map((m) => m.creditTotal || 0);

    // --- Daily breakdown: debit line ---
    const daily = stats.dailyBreakdown;
    const dailyLabels = daily.map((d) => d.date.split("-")[2]);
    const debitDailyValues = daily.map((d) => d.debitTotal || 0);
    const creditDailyValues = daily.map((d) => d.creditTotal || 0);

    // --- Pie chart (debit categories only) ---
    const pieData = stats.categoryBreakdown.slice(0, 5).map((c, i) => ({
      name: c.name,
      population: c.total,
      color: ["#EF4444", "#F97316", "#EAB308", "#8B5CF6", "#EC4899"][i % 5],
      legendFontColor: colors.textSecondary,
      legendFontSize: 12,
    }));

    const hasDebitTrend = debitTrendValues.some((v) => v > 0);
    const hasCreditTrend = creditTrendValues.some((v) => v > 0);
    const hasDaily = daily.length > 0;

    return (
      <View style={{ gap: 24, paddingBottom: 40 }}>
        {/* Monthly Comparison — Debit vs Credit */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            6-Month Trend
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Debit spending
          </Text>
          {hasDebitTrend ? (
            <BarChart
              data={{
                labels: trendLabels,
                datasets: [{ data: debitTrendValues, color: () => colors.danger }],
              }}
              width={SCREEN_WIDTH - 32}
              height={180}
              yAxisLabel="₹"
              yAxisSuffix=""
              chartConfig={{
                ...chartConfig,
                color: () => colors.danger,
              }}
              style={{ borderRadius: 16, marginTop: 8 }}
              showValuesOnTopOfBars={false}
            />
          ) : (
            <Text style={[styles.emptyChart, { color: colors.textSecondary }]}>
              No debit data this period.
            </Text>
          )}
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 12 }]}>
            Credit income
          </Text>
          {hasCreditTrend ? (
            <BarChart
              data={{
                labels: trendLabels,
                datasets: [{ data: creditTrendValues, color: () => colors.credit }],
              }}
              width={SCREEN_WIDTH - 32}
              height={180}
              yAxisLabel="₹"
              yAxisSuffix=""
              chartConfig={{
                ...chartConfig,
                color: () => colors.credit,
              }}
              style={{ borderRadius: 16, marginTop: 8 }}
              showValuesOnTopOfBars={false}
            />
          ) : (
            <Text style={[styles.emptyChart, { color: colors.textSecondary }]}>
              No credit data this period.
            </Text>
          )}
        </View>

        {/* Daily Debit Line */}
        {hasDaily && debitDailyValues.some((v) => v > 0) && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Daily Spending ({stats.selectedMonth.month}/{stats.selectedMonth.year})
            </Text>
            <LineChart
              data={{
                labels: dailyLabels.map((l, i) => (i % 5 === 0 ? l : "")),
                datasets: [
                  {
                    data: debitDailyValues,
                    color: () => colors.danger,
                    strokeWidth: 2,
                  },
                ],
              }}
              width={SCREEN_WIDTH - 32}
              height={200}
              yAxisLabel="₹"
              chartConfig={{
                ...chartConfig,
                propsForDots: { r: "3" },
              }}
              bezier
              style={{ borderRadius: 16, marginTop: 8 }}
            />
          </View>
        )}

        {/* Daily Credit Line */}
        {hasDaily && creditDailyValues.some((v) => v > 0) && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Daily Credits ({stats.selectedMonth.month}/{stats.selectedMonth.year})
            </Text>
            <LineChart
              data={{
                labels: dailyLabels.map((l, i) => (i % 5 === 0 ? l : "")),
                datasets: [
                  {
                    data: creditDailyValues,
                    color: () => colors.credit,
                    strokeWidth: 2,
                  },
                ],
              }}
              width={SCREEN_WIDTH - 32}
              height={200}
              yAxisLabel="₹"
              chartConfig={{
                ...chartConfig,
                propsForDots: { r: "3", fill: colors.credit },
              }}
              bezier
              style={{ borderRadius: 16, marginTop: 8 }}
            />
          </View>
        )}

        {/* Category Breakdown (debits only) */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Category Breakdown
          </Text>
          {pieData.length > 0 ? (
            <>
              <PieChart
                data={pieData}
                width={SCREEN_WIDTH - 32}
                height={200}
                chartConfig={chartConfig}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
              <View style={{ marginTop: 16, gap: 8 }}>
                {stats.categoryBreakdown.map((item, index) => (
                  <View key={index} style={styles.categoryRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <View
                        style={[
                          styles.categoryDot,
                          {
                            backgroundColor:
                              index < 5
                                ? ["#EF4444", "#F97316", "#EAB308", "#8B5CF6", "#EC4899"][index]
                                : colors.border,
                          },
                        ]}
                      />
                      <Text style={{ color: colors.text, fontSize: 14 }}>
                        {item.name}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginRight: 12 }}>
                      {item.percentage}%
                    </Text>
                    <Text style={{ color: colors.danger, fontWeight: "600", fontSize: 14 }}>
                      ₹{item.total.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={[styles.emptyChart, { color: colors.textSecondary }]}>
              No debit expense categories this month.
            </Text>
          )}
        </View>

        {/* Top 5 Expenses */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Top Expenses
          </Text>
          {stats.top5Expenses.length > 0 ? (
            stats.top5Expenses.map((expense) => (
              <View
                key={expense._id}
                style={[
                  styles.topExpenseCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                    {new Date(expense.date).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.expenseName, { color: colors.text }]} numberOfLines={1}>
                    {expense.remarks || expense.category || "Uncategorized"}
                  </Text>
                </View>
                <Text style={[styles.expenseAmount, { color: colors.danger }]}>
                  ₹{expense.amount.toLocaleString()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyChart, { color: colors.textSecondary }]}>
              No expenses found.
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
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
        <Text style={[styles.title, { color: colors.text }]}>Analytics</Text>
        <TouchableOpacity
          onPress={handleDownloadReport}
          style={styles.downloadButton}
        >
          <Ionicons name="download-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {renderMonthSelector()}

      <ScrollView contentContainerStyle={styles.content}>
        {renderSummaryCards()}
        {renderAvgRow()}
        {renderCharts()}
      </ScrollView>
    </SafeAreaView>
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
  downloadButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700" },

  monthSelector: {
    maxHeight: 60,
    marginTop: 12,
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    height: 36,
    justifyContent: "center",
  },
  monthPillText: { fontSize: 13, fontWeight: "600" },

  content: { padding: 16 },

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
    gap: 4,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  summaryValue: { fontSize: 15, fontWeight: "800" },
  summaryCount: { fontSize: 10 },

  avgRow: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    overflow: "hidden",
  },
  avgItem: {
    flex: 1,
    padding: 14,
    alignItems: "center",
  },
  avgDivider: {
    width: 1,
  },
  avgLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  avgValue: { fontSize: 16, fontWeight: "800" },

  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  emptyChart: { fontStyle: "italic", margin: 10 },

  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },

  topExpenseCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  expenseDate: { fontSize: 11, marginBottom: 2 },
  expenseName: { fontSize: 14, fontWeight: "500" },
  expenseAmount: { fontSize: 15, fontWeight: "700" },
});

export default ExpenseStatsScreen;
