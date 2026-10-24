import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { useTheme } from "../../contexts/ThemeContext";
import {
  getAdvancedStatsApi,
  getExpenseExportHtmlApi,
} from "../../api/expenseApi";
import { IAdvancedExpenseStats, IAvailableMonth } from "../../types";
import { logger } from "../../utils/logger";
import { describeError } from "../../api/axios";
import { buildExpenseInsights } from "../../utils/expenseInsights";
import {
  YearMonth,
  currentYearMonth,
  isSameMonth,
  mergeWindowCounts,
  monthKey,
  monthsEndingAt,
} from "../../utils/months";
import MonthSelector from "../../components/chat/MonthSelector";
import {
  BigTicketsSection,
  CategoriesSection,
  DailyRhythmSection,
  EmptyState,
  ErrorState,
  HeroSection,
  InsightsSection,
  PaceSection,
  StatsSkeleton,
  TrendSection,
  WeeklyPatternSection,
  monthLabel,
} from "./expenseStatsSections";

const MONTHS_BACK = 18;
// getAdvancedStats' monthlyTrend covers the requested month and the 12 before
// it, listing only months that have rows.
const TREND_WINDOW = 13;

/** monthKey -> debitCount + creditCount, from a report's monthlyTrend. */
const trendTxCounts = (
  trend: IAdvancedExpenseStats["monthlyTrend"] | undefined,
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const t of trend ?? []) {
    if (!Number.isFinite(t?.year) || !Number.isFinite(t?.monthNum)) continue;
    const count = (t.debitCount ?? 0) + (t.creditCount ?? 0);
    out[monthKey({ year: t.year, month: t.monthNum })] =
      Number.isFinite(count) ? count : 0;
  }
  return out;
};

const ExpenseStatsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, spacing, fontSize, fontWeight } = theme;
  const { width: windowWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<IAdvancedExpenseStats | null>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadingRef = useRef(false);
  const requestId = useRef(0);

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  // Transaction counts per month seen in any loaded report's monthlyTrend, kept
  // across month changes so the selector's caption and badges stay filled in
  // while the next month loads. No extra requests. Counts are partial (months
  // outside every loaded window are unknown), so they never disable a month.
  const [trendCounts, setTrendCounts] = useState<Record<string, number>>({});

  // The last MONTHS_BACK months up to (and including) the current one.
  const selectorMonths = useMemo<IAvailableMonth[]>(
    () =>
      monthsEndingAt(currentYearMonth(new Date()), MONTHS_BACK).map((ym) => ({
        ...ym,
        txCount: trendCounts[monthKey(ym)] ?? 0,
      })),
    [trendCounts],
  );

  const handleMonthChange = useCallback((ym: YearMonth) => {
    setSelectedDate((prev) =>
      isSameMonth(prev, ym) ? prev : { year: ym.year, month: ym.month },
    );
  }, []);

  const loadStats = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const id = ++requestId.current;
      if (mode === "initial") {
        setLoading(true);
        setStats(null);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const response = await getAdvancedStatsApi(
          selectedDate.year,
          selectedDate.month,
        );
        if (id !== requestId.current) return; // a newer month was picked
        if (response.data.success) {
          const data = response.data.data;
          setStats(data);
          // Reset the reply's whole window first: a month whose rows were all
          // deleted is simply missing from monthlyTrend.
          setTrendCounts((prev) =>
            mergeWindowCounts(
              prev,
              selectedDate,
              TREND_WINDOW,
              trendTxCounts(data?.monthlyTrend),
            ),
          );
        } else {
          setError("Could not load analytics for this month.");
        }
      } catch (e) {
        if (id !== requestId.current) return;
        logger.error("Failed to load advanced stats:", e);
        setError(describeError(e));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedDate],
  );

  useEffect(() => {
    loadStats("initial");
  }, [loadStats]);

  const handleDownloadReport = async () => {
    if (downloadingRef.current) return;
    if (!stats?.selectedLedger?._id) {
      Alert.alert(
        "No Data",
        "No ledger found for this month. Add some expenses first.",
      );
      return;
    }
    downloadingRef.current = true;
    setDownloading(true);
    try {
      const response = await getExpenseExportHtmlApi(stats.selectedLedger._id);
      const html = response.data?.html;
      if (!html) throw new Error("No HTML returned from server");

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: "com.adobe.pdf",
        mimeType: "application/pdf",
      });
    } catch (error) {
      logger.error("PDF export failed", error);
      Alert.alert("Could not create report", describeError(error));
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  };

  // Screen gutter (lg) + card padding (lg) + card border, on both sides.
  const chartWidth = Math.max(
    windowWidth - spacing.lg * 2 - spacing.lg * 2 - 2,
    120,
  );

  const today = useMemo(() => new Date(), [stats]);
  const insights = useMemo(
    () => (stats ? buildExpenseInsights(stats, today) : []),
    [stats, today],
  );

  const isEmpty =
    !!stats &&
    (stats.summary?.debitCount ?? 0) + (stats.summary?.creditCount ?? 0) === 0;

  const renderBody = () => {
    if (loading) return <StatsSkeleton />;
    if (!stats) {
      return (
        <ErrorState
          message={error ?? "Could not load analytics."}
          onRetry={() => loadStats("initial")}
        />
      );
    }
    if (isEmpty) {
      return (
        <View style={{ gap: spacing.lg }}>
          {error ? (
            <ErrorState compact message={error} onRetry={() => loadStats("refresh")} />
          ) : null}
          <EmptyState
            title={`Nothing recorded in ${monthLabel(selectedDate)}`}
            message="Add some expenses or income and your analytics will show up here."
          />
        </View>
      );
    }
    return (
      <View style={{ gap: spacing.lg }}>
        {error ? (
          <ErrorState compact message={error} onRetry={() => loadStats("refresh")} />
        ) : null}
        <HeroSection stats={stats} today={today} />
        <PaceSection stats={stats} today={today} chartWidth={chartWidth} />
        <InsightsSection insights={insights} />
        <CategoriesSection stats={stats} />
        <DailyRhythmSection stats={stats} today={today} />
        <WeeklyPatternSection stats={stats} />
        <TrendSection stats={stats} today={today} />
        <BigTicketsSection stats={stats} />
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: fontSize.xs,
            textAlign: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          Analytics include all debits and credits in this ledger month.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.text,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
          }}
        >
          Analytics
        </Text>
        <TouchableOpacity
          onPress={handleDownloadReport}
          disabled={downloading}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={
            downloading ? "Creating report" : "Download PDF report"
          }
          accessibilityState={{ busy: downloading, disabled: downloading }}
          hitSlop={8}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons
              name="download-outline"
              size={22}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* A plain View (flexShrink 0) so the report below can't squeeze it. */}
      <View style={styles.monthSelector}>
        <MonthSelector
          months={selectorMonths}
          selected={selectedDate}
          onChange={handleMonthChange}
          loading={loading}
          enableAllMonths
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadStats("refresh")}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {renderBody()}
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
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  monthSelector: { flexShrink: 0 },
});

export default ExpenseStatsScreen;
