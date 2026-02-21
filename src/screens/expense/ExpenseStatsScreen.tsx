import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing"; // Use expo-sharing for PDF

import { useTheme } from "../../contexts/ThemeContext";
import { getAdvancedStatsApi } from "../../api/expenseApi";
import { IAdvancedExpenseStats } from "../../types";

const SCREEN_WIDTH = Dimensions.get("window").width;

const ExpenseStatsScreen = ({ navigation }: any) => {
  const { theme, isDark } = useTheme();
  const { colors } = theme;

  // State
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<IAdvancedExpenseStats | null>(null);

  // Default to current month/year
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  // Generate last 18 months for selector
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
    if (!stats) return;
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #333; }
              h1 { color: ${colors.primary}; text-align: center; }
              .header { margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
              .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 30px; }
              .card { background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; }
              .card h3 { margin: 0; font-size: 24px; color: ${colors.primary}; }
              .card p { margin: 5px 0 0; font-size: 14px; color: #666; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f2f2f2; }
              .amount { font-weight: bold; }
              .credit { color: green; }
              .debit { color: red; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Expense Report</h1>
              <p style="text-align: center;">
                Period: ${new Date(stats.selectedMonth.year, stats.selectedMonth.month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>

            <div class="summary-grid">
              <div class="card">
                <h3>₹${stats.summary.total.toFixed(2)}</h3>
                <p>Total Spent</p>
              </div>
              <div class="card">
                <h3>${stats.summary.count}</h3>
                <p>Transactions</p>
              </div>
              <div class="card">
                <h3>₹${stats.summary.avgDailySpend.toFixed(2)}</h3>
                <p>Daily Average</p>
              </div>
            </div>

            <h2>Top Expenses</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category / Remarks</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${stats.top5Expenses
                  .map(
                    (t) => `
                  <tr>
                    <td>${new Date(t.date).toLocaleDateString()}</td>
                    <td>${t.category || t.remarks || "Uncategorized"}</td>
                    <td class="amount">₹${t.amount.toFixed(2)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>

            <h2>Category Breakdown</h2>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Transactions</th>
                  <th>Total</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                ${stats.categoryBreakdown
                  .map(
                    (c) => `
                  <tr>
                    <td>${c.name}</td>
                    <td>${c.count}</td>
                    <td>₹${c.total.toFixed(2)}</td>
                    <td>${c.percentage}%</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;

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

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Total
        </Text>
        <Text
          style={[styles.summaryValue, { color: colors.danger }]}
          numberOfLines={1}
        >
          {loading ? "..." : `₹${stats?.summary.total.toLocaleString() || "0"}`}
        </Text>
      </View>
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Txns
        </Text>
        <Text
          style={[styles.summaryValue, { color: colors.text }]}
          numberOfLines={1}
        >
          {loading ? "..." : stats?.summary.count || 0}
        </Text>
      </View>
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Avg/Day
        </Text>
        <Text
          style={[styles.summaryValue, { color: colors.primary }]}
          numberOfLines={1}
        >
          {loading
            ? "..."
            : `₹${Math.round(stats?.summary.avgDailySpend || 0)}`}
        </Text>
      </View>
    </View>
  );

  const renderCharts = () => {
    if (!stats || loading)
      return (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      );

    // Monthly Trend Data
    const trendLabels = stats.monthlyTrend
      .map((m) => {
        const [y, mo] = m.month.split("-");
        const date = new Date(parseInt(y), parseInt(mo) - 1);
        return date.toLocaleDateString("en-US", { month: "short" });
      })
      .slice(-6); // Last 6 months only

    const trendValues = stats.monthlyTrend.map((m) => m.total).slice(-6);

    // Daily Spend Data (Sample down if too many days for cleaner chart)
    const dailyLabels = stats.dailyBreakdown.map((d) => d.date.split("-")[2]); // Day only
    const dailyValues = stats.dailyBreakdown.map((d) => d.total);

    // Pie Chart Data
    const pieData = stats.categoryBreakdown.slice(0, 5).map((c, i) => ({
      name: c.name,
      population: c.total,
      color: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"][i % 5],
      legendFontColor: colors.textSecondary,
      legendFontSize: 12,
    }));

    return (
      <View style={{ gap: 24, paddingBottom: 40 }}>
        {/* Monthly Trend */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Last 6 Months Trend
          </Text>
          {trendValues.length > 0 ? (
            <BarChart
              data={{
                labels: trendLabels,
                datasets: [{ data: trendValues }],
              }}
              width={SCREEN_WIDTH - 32}
              height={220}
              yAxisLabel="₹"
              yAxisSuffix=""
              chartConfig={chartConfig}
              style={{ borderRadius: 16, marginTop: 8 }}
              showValuesOnTopOfBars={false} // Clean look
            />
          ) : (
            <Text
              style={{
                color: colors.textSecondary,
                fontStyle: "italic",
                margin: 10,
              }}
            >
              No trend data available.
            </Text>
          )}
        </View>

        {/* Daily Spend */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Daily Spending ({stats.selectedMonth.month}/
            {stats.selectedMonth.year})
          </Text>
          {dailyValues.length > 0 ? (
            <LineChart
              data={{
                labels: dailyLabels.map((l, i) => (i % 5 === 0 ? l : "")), // Show every 5th label
                datasets: [{ data: dailyValues }],
              }}
              width={SCREEN_WIDTH - 32}
              height={220}
              yAxisLabel="₹"
              chartConfig={{
                ...chartConfig,
                propsForDots: { r: "3" },
              }}
              bezier
              style={{ borderRadius: 16, marginTop: 8 }}
            />
          ) : (
            <Text
              style={{
                color: colors.textSecondary,
                fontStyle: "italic",
                margin: 10,
              }}
            >
              No daily data available.
            </Text>
          )}
        </View>

        {/* Categories */}
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
              {/* Detailed List */}
              <View style={{ marginTop: 16, gap: 8 }}>
                {stats.categoryBreakdown.map((item, index) => (
                  <View key={index} style={styles.categoryRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor:
                            index < 5
                              ? [
                                  "#FF6384",
                                  "#36A2EB",
                                  "#FFCE56",
                                  "#4BC0C0",
                                  "#9966FF",
                                ][index]
                              : colors.border,
                          marginRight: 8,
                        }}
                      />
                      <Text style={{ color: colors.text, fontSize: 14 }}>
                        {item.name}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                        marginRight: 12,
                      }}
                    >
                      {item.percentage}%
                    </Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      ₹{item.total.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text
              style={{
                color: colors.textSecondary,
                fontStyle: "italic",
                margin: 10,
              }}
            >
              No category data available.
            </Text>
          )}
        </View>

        {/* Top 5 Expenses */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Top Large Expenses
          </Text>
          {stats.top5Expenses.length > 0 ? (
            stats.top5Expenses.map((expense) => (
              <View
                key={expense._id}
                style={[
                  styles.topExpenseCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.expenseDate,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {new Date(expense.date).toLocaleDateString()}
                  </Text>
                  <Text
                    style={[styles.expenseName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {expense.remarks || expense.category || "Uncategorized"}
                  </Text>
                </View>
                <Text style={[styles.expenseAmount, { color: colors.danger }]}>
                  ₹{expense.amount.toLocaleString()}
                </Text>
              </View>
            ))
          ) : (
            <Text
              style={{
                color: colors.textSecondary,
                fontStyle: "italic",
                margin: 10,
              }}
            >
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

  content: {
    padding: 16,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  summaryLabel: { fontSize: 12, marginBottom: 4, fontWeight: "500" },
  summaryValue: { fontSize: 16, fontWeight: "700" },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },

  topExpenseCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  expenseDate: { fontSize: 11, marginBottom: 2 },
  expenseName: { fontSize: 14, fontWeight: "500" },
  expenseAmount: { fontSize: 15, fontWeight: "700" },
});

export default ExpenseStatsScreen;
