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
import { IAdvancedExpenseStats } from "../../types";
import { logger } from "../../utils/logger";
import { describeError } from "../../api/axios";
import { buildExpenseInsights } from "../../utils/expenseInsights";
import {
  BigTicketsSection,
  CategoriesSection,
  DailyRhythmSection,
  EmptyState,
  ErrorState,
  HeroSection,
  InsightsSection,
  ON_ACCENT,
  PaceSection,
  StatsSkeleton,
  TrendSection,
  WeeklyPatternSection,
  monthLabel,
} from "./expenseStatsSections";

const MONTHS_BACK = 18;

const ExpenseStatsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, spacing, fontSize, fontWeight, borderRadius } = theme;
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

  const availableMonths = useMemo(() => {
    const months = [];
    const current = new Date();
    for (let i = 0; i < MONTHS_BACK; i++) {
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
          setStats(response.data.data);
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

  const renderMonthSelector = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.monthSelector}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
      }}
    >
      {availableMonths.map((m) => {
        const isSelected =
          m.year === selectedDate.year && m.month === selectedDate.month;
        return (
          <TouchableOpacity
            key={`${m.year}-${m.month}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${m.label}${isSelected ? ", selected" : ""}`}
            style={[
              styles.monthPill,
              {
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing.lg,
                backgroundColor: isSelected ? colors.primary : colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSelectedDate({ year: m.year, month: m.month })}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: isSelected ? ON_ACCENT : colors.textSecondary,
              }}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

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

      {renderMonthSelector()}

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
  monthSelector: {
    flexGrow: 0,
    marginTop: 12,
    marginBottom: 4,
  },
  monthPill: {
    height: 36,
    borderWidth: 1,
    justifyContent: "center",
  },
});

export default ExpenseStatsScreen;
