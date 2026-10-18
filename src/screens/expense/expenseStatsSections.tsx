import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../contexts/ThemeContext";
import { IAdvancedExpenseStats } from "../../types";
import { formatCurrency } from "../../utils/money";
import { formatDate } from "../../utils/dates";
import { withAlpha } from "../../utils/chartPalette";
import {
  ExpenseInsight,
  YearMonth,
  bestWorstMonth,
  cumulativeSeries,
  monthOverMonth,
  noSpendStats,
  pctChange,
  projectMonthEnd,
  savingsRate,
  threeMonthAverageMonths,
  threeMonthAverageSpend,
  topConcentration,
  weekOfMonthTotals,
  weekdayTotals,
  weekendShare,
  zeroFillTrend,
} from "../../utils/expenseInsights";
import DonutChart, { DonutDatum } from "../../components/charts/DonutChart";
import ProgressRing from "../../components/charts/ProgressRing";
import AreaLineChart from "../../components/charts/AreaLineChart";
import Sparkline from "../../components/charts/Sparkline";
import CalendarHeatmap from "../../components/charts/CalendarHeatmap";
import WeekdayBars from "../../components/charts/WeekdayBars";
import DivergingBars from "../../components/charts/DivergingBars";
import {
  WEEKDAY_SHORT_MON_FIRST,
  daysInMonth,
} from "../../components/charts/calendar";
import { formatAxisAmount } from "../../components/charts/scale";

/** Text/icon colour on top of a solid brand-coloured fill. */
export const ON_ACCENT = "#FFFFFF";

export type Stats = IAdvancedExpenseStats;

const MONTH_SHORT = [
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
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const monthLabel = (ym: YearMonth): string =>
  `${MONTH_LONG[ym.month - 1] ?? ""} ${ym.year}`;

const pct = (n: number): string => `${Math.round(n)}%`;

const sharePct = (n: number): string =>
  n > 0 && n < 10 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`;

/** Day-of-month -> debit total for one month. */
const dailyDebitMap = (
  daily: Stats["dailyBreakdown"],
  year: number,
  month: number,
): Record<number, number> => {
  const out: Record<number, number> = {};
  for (const row of daily ?? []) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(row.date ?? "");
    if (!m || Number(m[1]) !== year || Number(m[2]) !== month) continue;
    const d = Number(m[3]);
    const v = Number.isFinite(row.debitTotal) ? row.debitTotal : 0;
    out[d] = (out[d] ?? 0) + v;
  }
  return out;
};

/**
 * The category an expense is reported under; mirrors the server's
 * expenseCategoryOf: a leading "#tag" in the remarks wins ("#travel cab" ->
 * "travel cab"), else the trimmed category, else "Other" (also for "-").
 */
const expenseCategoryOf = (e: {
  remarks?: string | null;
  category?: string | null;
}): string => {
  const tag =
    typeof e.remarks === "string" ? /^#\s*(.+)/.exec(e.remarks) : null;
  const tagged = tag ? tag[1].trim() : "";
  if (tagged) return tagged;
  const category = typeof e.category === "string" ? e.category.trim() : "";
  if (category && category !== "-") return category;
  return "Other";
};

// ------------------------------------------------------------------
// Primitives
// ------------------------------------------------------------------

export const Card: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
}> = ({ title, subtitle }) => {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing } = theme;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.text,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const LegendDot: React.FC<{ color: string; label: string }> = ({
  color,
  label,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize } = theme;
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>
        {label}
      </Text>
    </View>
  );
};

/** Three short dashes, to key a dashed chart line. */
const LegendDash: React.FC<{ color: string; label: string }> = ({
  color,
  label,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize } = theme;
  return (
    <View style={styles.legendItem}>
      <View style={styles.dashRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dash, { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>
        {label}
      </Text>
    </View>
  );
};

// ------------------------------------------------------------------
// Loading / empty / error
// ------------------------------------------------------------------

const SkeletonBlock: React.FC<{
  pulse: Animated.Value;
  height: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ pulse, height, width = "100%", radius, style }) => {
  const { theme } = useTheme();
  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius: radius ?? theme.borderRadius.sm,
          backgroundColor: theme.colors.chart.track,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
};

export const StatsSkeleton: React.FC = () => {
  const { theme } = useTheme();
  const { spacing } = theme;
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View
      style={{ gap: spacing.lg }}
      accessible
      accessibilityLabel="Loading analytics"
    >
      <Card>
        <SkeletonBlock pulse={pulse} height={14} width="40%" />
        <SkeletonBlock
          pulse={pulse}
          height={30}
          width="60%"
          style={{ marginTop: spacing.sm }}
        />
        <View style={[styles.row, { marginTop: spacing.lg, gap: spacing.lg }]}>
          <SkeletonBlock pulse={pulse} height={96} width={96} radius={48} />
          <View style={{ flex: 1, gap: spacing.md }}>
            <SkeletonBlock pulse={pulse} height={40} />
            <SkeletonBlock pulse={pulse} height={40} />
          </View>
        </View>
      </Card>
      <Card>
        <SkeletonBlock pulse={pulse} height={16} width="50%" />
        <SkeletonBlock
          pulse={pulse}
          height={140}
          style={{ marginTop: spacing.md }}
        />
      </Card>
      <Card>
        <SkeletonBlock pulse={pulse} height={16} width="35%" />
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <SkeletonBlock pulse={pulse} height={48} />
          <SkeletonBlock pulse={pulse} height={48} />
          <SkeletonBlock pulse={pulse} height={48} />
        </View>
      </Card>
      <Card>
        <SkeletonBlock pulse={pulse} height={16} width="45%" />
        <SkeletonBlock
          pulse={pulse}
          height={180}
          radius={90}
          width={180}
          style={{ alignSelf: "center", marginTop: spacing.md }}
        />
      </Card>
    </View>
  );
};

export const EmptyState: React.FC<{ title: string; message: string }> = ({
  title,
  message,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing } = theme;
  return (
    <Card style={{ alignItems: "center", paddingVertical: spacing.xxxl }}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.chart.track },
        ]}
      >
        <Ionicons name="bar-chart-outline" size={30} color={colors.primary} />
      </View>
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
          marginTop: spacing.lg,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.sm,
          marginTop: spacing.xs,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </Card>
  );
};

export const ErrorState: React.FC<{
  message: string;
  onRetry: () => void;
  compact?: boolean;
}> = ({ message, onRetry, compact }) => {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing, borderRadius } = theme;
  return (
    <Card
      style={
        compact
          ? { flexDirection: "row", alignItems: "center", gap: spacing.md }
          : { alignItems: "center", paddingVertical: spacing.xxxl }
      }
    >
      <Ionicons
        name="cloud-offline-outline"
        size={compact ? 22 : 34}
        color={colors.chart.negative}
      />
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.sm,
          marginTop: compact ? 0 : spacing.md,
          textAlign: compact ? "left" : "center",
          flex: compact ? 1 : undefined,
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading analytics"
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          marginTop: compact ? 0 : spacing.lg,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          style={{
            color: ON_ACCENT,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
          }}
        >
          Retry
        </Text>
      </Pressable>
    </Card>
  );
};

// ------------------------------------------------------------------
// Hero
// ------------------------------------------------------------------

const DeltaChip: React.FC<{
  change: number | null;
  goodWhenUp: boolean;
  versus: string;
}> = ({ change, goodWhenUp, versus }) => {
  const { theme } = useTheme();
  const { colors, fontSize } = theme;
  if (change === null || Math.round(Math.abs(change)) < 1) return null;
  const up = change > 0;
  const good = up === goodWhenUp;
  const tint = good ? colors.chart.positive : colors.chart.negative;
  return (
    <View
      style={[styles.deltaChip, { backgroundColor: withAlpha(tint, 0.14) }]}
      accessible
      accessibilityLabel={`${up ? "Up" : "Down"} ${Math.round(Math.abs(change))} percent versus ${versus}`}
    >
      <Ionicons name={up ? "arrow-up" : "arrow-down"} size={11} color={tint} />
      <Text
        style={{ color: tint, fontSize: fontSize.xs, fontWeight: "700" }}
      >
        {pct(Math.abs(change))}
      </Text>
    </View>
  );
};

const HeroFigure: React.FC<{
  label: string;
  amount: number;
  color: string;
  spark: number[];
  change: number | null;
  goodWhenUp: boolean;
  versus: string;
}> = ({ label, amount, color, spark, change, goodWhenUp, versus }) => {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing } = theme;
  return (
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <View style={{ flex: 1 }}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <View style={[styles.legendDot, { backgroundColor: color }]} />
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
            {label}
          </Text>
          <DeltaChip change={change} goodWhenUp={goodWhenUp} versus={versus} />
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            color: colors.text,
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            marginTop: 2,
          }}
        >
          {formatCurrency(amount)}
        </Text>
      </View>
      <Sparkline data={spark} color={color} width={72} height={30} />
    </View>
  );
};

export const HeroSection = React.memo(function HeroSection({
  stats,
  today,
}: {
  stats: Stats;
  today: Date;
}) {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing } = theme;
  const s = stats.summary;
  const sel = stats.selectedMonth;
  const trend = stats.monthlyTrend ?? [];

  const income = s.totalCredits;
  const spend = s.totalDebits;
  const net = s.net;
  const rate = savingsRate(income, spend);
  const mom = useMemo(
    () => monthOverMonth(trend, sel, today),
    [trend, sel, today],
  );
  const isCurrentMonth =
    sel.year === today.getFullYear() && sel.month === today.getMonth() + 1;
  const versus = isCurrentMonth ? "the same point last month" : "last month";

  // Expense-only users have nothing to "overspend" against: stay neutral.
  const noIncome = !(income > 0);
  const saved = net >= 0;
  const headTint = noIncome
    ? colors.text
    : saved
      ? colors.chart.positive
      : colors.chart.negative;
  const headline = noIncome
    ? `Spent ${formatCurrency(spend)}`
    : `${saved ? "Saved" : "Overspent"} ${formatCurrency(Math.abs(net))}`;
  const ringColor = rate !== null && rate < 0 ? colors.chart.negative : colors.chart.positive;

  return (
    <Card>
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
        {monthLabel(sel)}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityRole="header"
        style={{
          color: headTint,
          fontSize: fontSize.xxxl,
          fontWeight: fontWeight.heavy,
          marginTop: 2,
        }}
      >
        {headline}
      </Text>

      <View
        style={[
          styles.row,
          { marginTop: spacing.xl, gap: spacing.xl, alignItems: "center" },
        ]}
      >
        <ProgressRing
          value={rate !== null ? Math.max(rate, 0) / 100 : 0}
          size={104}
          thickness={11}
          color={ringColor}
          label={rate !== null ? pct(rate) : "—"}
          sublabel="saved"
        />
        <View style={{ flex: 1, gap: spacing.lg }}>
          <HeroFigure
            label="Spent"
            amount={spend}
            color={colors.chart.spend}
            spark={trend.map((t) => t.debitTotal)}
            change={mom.spend}
            goodWhenUp={false}
            versus={versus}
          />
          <HeroFigure
            label="Received"
            amount={income}
            color={colors.chart.income}
            spark={trend.map((t) => t.creditTotal)}
            change={mom.income}
            goodWhenUp
            versus={versus}
          />
        </View>
      </View>
      {rate === null ? (
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: fontSize.xs,
            marginTop: spacing.md,
          }}
        >
          No income recorded this month, so there is no savings rate.
        </Text>
      ) : null}
    </Card>
  );
});

// ------------------------------------------------------------------
// Pace
// ------------------------------------------------------------------

export const PaceSection = React.memo(function PaceSection({
  stats,
  today,
  chartWidth,
}: {
  stats: Stats;
  today: Date;
  chartWidth: number;
}) {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing } = theme;
  const sel = stats.selectedMonth;
  const spend = stats.summary.totalDebits;
  const dim = daysInMonth(sel.year, sel.month);

  const avg = useMemo(
    () => threeMonthAverageSpend(stats.monthlyTrend ?? [], sel),
    [stats.monthlyTrend, sel],
  );
  const avgMonths = useMemo(
    () => threeMonthAverageMonths(stats.monthlyTrend ?? [], sel),
    [stats.monthlyTrend, sel],
  );
  const avgName = `your ${avgMonths}-month average`;
  const proj = useMemo(
    () => projectMonthEnd(spend, sel, today, avg),
    [spend, sel, today, avg],
  );
  const tooEarly = proj.tooEarly === true;

  const series = useMemo(
    () =>
      cumulativeSeries(
        stats.dailyBreakdown ?? [],
        sel.year,
        sel.month,
        proj.isCurrentMonth ? proj.daysElapsed : undefined,
      ),
    [stats.dailyBreakdown, sel, proj.isCurrentMonth, proj.daysElapsed],
  );

  const diff =
    avg !== null && !tooEarly ? pctChange(proj.projected, avg) : null;
  const compareLine = useMemo(
    () => (avg !== null ? new Array<number>(dim).fill(avg) : undefined),
    [dim, avg],
  );
  const showProjection = proj.isCurrentMonth && !tooEarly;

  const xLabels = (i: number): string | null => {
    const day = i + 1;
    return day === 1 || day === 8 || day === 15 || day === 22 || day === dim
      ? String(day)
      : null;
  };

  let headline: string;
  let detail: string;
  let tint = colors.textSecondary;
  headline = tooEarly
    ? `Too early to project — ${formatCurrency(spend)} spent so far`
    : proj.isCurrentMonth
      ? `On pace for ${formatCurrency(proj.projected)}`
      : `Spent ${formatCurrency(spend)}`;
  if (avg === null) {
    detail = "No earlier months to compare against yet.";
  } else if (diff === null) {
    detail = `${avgName[0].toUpperCase()}${avgName.slice(1)} is ${formatCurrency(avg)}`;
  } else {
    const abs = Math.round(Math.abs(diff));
    if (abs < 1) {
      detail = `In line with ${avgName} of ${formatCurrency(avg)}`;
    } else {
      const dir = diff > 0 ? "above" : "below";
      detail = proj.isCurrentMonth
        ? `${abs}% ${dir} ${avgName} of ${formatCurrency(avg)}`
        : `${abs}% ${dir} ${avgName}`;
      tint = diff > 0 ? colors.chart.negative : colors.chart.positive;
    }
  }
  const avgShort = `${avgMonths}-mo avg`;

  return (
    <Card>
      <SectionHeader title="Pace" />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: colors.text,
          fontSize: fontSize.xxl,
          fontWeight: fontWeight.heavy,
        }}
      >
        {headline}
      </Text>
      <Text
        style={{
          color: tint,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          marginTop: 2,
          marginBottom: spacing.md,
        }}
      >
        {detail}
      </Text>
      <AreaLineChart
        series={series}
        compare={proj.isCurrentMonth ? compareLine : undefined}
        compareColor={colors.chart.axis}
        compareLabel={avgShort}
        projectionTo={showProjection ? proj.projected : undefined}
        width={chartWidth}
        height={190}
        xLabels={xLabels}
        valueFormatter={formatCurrency}
      />
      <View style={[styles.legendRow, { marginTop: spacing.sm }]}>
        <LegendDot color={colors.chart.spend} label="Spent so far" />
        {proj.isCurrentMonth && avg !== null ? (
          <LegendDash color={colors.chart.axis} label={avgShort} />
        ) : null}
        {showProjection ? (
          <LegendDash color={colors.chart.spend} label="Projected" />
        ) : null}
      </View>
    </Card>
  );
});

// ------------------------------------------------------------------
// Insights
// ------------------------------------------------------------------

const INSIGHT_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  savings: "wallet-outline",
  pace: "speedometer-outline",
  mom: "swap-vertical-outline",
  category: "pie-chart-outline",
  firstWeek: "calendar-outline",
  weekend: "sunny-outline",
  noSpend: "leaf-outline",
};

export const InsightsSection = React.memo(function InsightsSection({
  insights,
}: {
  insights: ExpenseInsight[];
}) {
  const { theme } = useTheme();
  const { colors, fontSize, spacing, borderRadius } = theme;
  if (insights.length === 0) return null;

  const toneColor = (tone: ExpenseInsight["tone"]): string => {
    switch (tone) {
      case "positive":
        return colors.chart.positive;
      case "negative":
        return colors.chart.negative;
      case "warning":
        return colors.warning;
      default:
        return colors.chart.spend;
    }
  };

  return (
    <View>
      <SectionHeader title="Insights" subtitle="What stands out this month" />
      <View style={{ gap: spacing.sm }}>
        {insights.map((ins, i) => {
          const tint = toneColor(ins.tone);
          return (
            <View
              key={`${ins.kind}-${i}`}
              style={[
                styles.insightCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderLeftColor: tint,
                  borderRadius: borderRadius.lg,
                  padding: spacing.md,
                  gap: spacing.md,
                },
              ]}
            >
              <View
                style={[
                  styles.insightIcon,
                  { backgroundColor: withAlpha(tint, 0.14) },
                ]}
              >
                <Ionicons
                  name={INSIGHT_ICON[ins.kind] ?? "bulb-outline"}
                  size={18}
                  color={tint}
                />
              </View>
              <Text
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: fontSize.sm,
                  lineHeight: 19,
                }}
              >
                {ins.text}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

// ------------------------------------------------------------------
// Where it went
// ------------------------------------------------------------------

interface CategoryRow {
  name: string;
  total: number;
  isOthers: boolean;
  trend: number[] | null;
}

const TOP_CATEGORIES = 7;
/** Slices below this share (percent) are folded into "Others". */
const MIN_SLICE_PCT = 1;

export const CategoriesSection = React.memo(function CategoriesSection({
  stats,
}: {
  stats: Stats;
}) {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing, borderRadius } = theme;
  const palette = colors.chart.categorical;
  const [selected, setSelected] = useState<number | null>(null);

  const categories = stats.categoryBreakdown;
  const totalSpend = stats.summary.totalDebits;

  const { rows, catSum, concentration } = useMemo(() => {
    const sorted = [...(categories ?? [])]
      .filter((c) => Number.isFinite(c.total) && c.total > 0)
      .sort((a, b) => b.total - a.total);
    const sum = sorted.reduce((a, c) => a + c.total, 0);
    // Sorted descending, so the slices under 1% are a suffix: cut at the
    // first one (or at TOP_CATEGORIES) and fold the rest into "Others".
    let cut = Math.min(sorted.length, TOP_CATEGORIES);
    const firstTiny = sorted.findIndex(
      (c) => sum > 0 && (c.total / sum) * 100 < MIN_SLICE_PCT,
    );
    if (firstTiny !== -1 && firstTiny < cut) cut = firstTiny;
    const top = sorted.slice(0, cut);
    const rest = sorted.slice(cut);
    const trendByName = new Map<string, number[]>();
    for (const t of stats.categoryTrend ?? []) {
      trendByName.set(
        t.name,
        t.months.map((m) => m.total),
      );
    }
    const out: CategoryRow[] = top.map((c) => ({
      name: c.name,
      total: c.total,
      isOthers: false,
      trend: trendByName.get(c.name) ?? null,
    }));
    if (rest.length > 0) {
      out.push({
        name: `Others (${rest.length})`,
        total: rest.reduce((a, c) => a + c.total, 0),
        isOthers: true,
        trend: null,
      });
    }
    return {
      rows: out,
      catSum: sum,
      concentration: topConcentration(sorted, 3),
    };
  }, [categories, stats.categoryTrend]);

  // The data (and so the donut) can change under a held selection.
  useEffect(() => setSelected(null), [rows]);

  // Same array, same order as the list, so donut index === row index.
  const donutData = useMemo<DonutDatum[]>(
    () =>
      rows.map((r, i) => ({
        label: r.name,
        value: r.total,
        color: palette[i % palette.length],
      })),
    [rows, palette],
  );

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <Card>
      <SectionHeader
        title="Where it went"
        subtitle="Spending by category"
      />
      {rows.length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
          No categorised spending this month.
        </Text>
      ) : (
        <>
          <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
            <DonutChart
              data={donutData}
              size={210}
              thickness={24}
              centerLabel="Spent"
              centerValue={formatCurrency(totalSpend)}
              selectedIndex={selected}
              onSelect={setSelected}
            />
          </View>

          {concentration !== null ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fontSize.sm,
                marginBottom: spacing.md,
              }}
            >
              Your top 3 categories make up{" "}
              <Text style={{ color: colors.text, fontWeight: fontWeight.bold }}>
                {pct(concentration)}
              </Text>{" "}
              of spending.
            </Text>
          ) : null}

          <View style={{ gap: spacing.xs }}>
            {rows.map((r, i) => {
              const color = palette[i % palette.length];
              const isSel = selected === i;
              const share = catSum > 0 ? (r.total / catSum) * 100 : 0;
              return (
                <View
                  key={r.name}
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.sm,
                    borderRadius: borderRadius.md,
                    backgroundColor: isSel
                      ? withAlpha(color, 0.14)
                      : "transparent",
                  }}
                >
                  <View style={[styles.row, { gap: spacing.sm }]}>
                    <View
                      style={[styles.legendDot, { backgroundColor: color }]}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: colors.text,
                        fontSize: fontSize.md,
                        fontWeight: fontWeight.medium,
                      }}
                    >
                      {r.name}
                    </Text>
                    {r.trend && r.trend.length > 1 ? (
                      <Sparkline
                        data={r.trend}
                        color={color}
                        width={48}
                        height={20}
                      />
                    ) : null}
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: fontSize.sm,
                        width: 40,
                        textAlign: "right",
                      }}
                    >
                      {sharePct(share)}
                    </Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        minWidth: 76,
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(r.total)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.barTrack,
                      {
                        backgroundColor: colors.chart.track,
                        marginTop: spacing.xs + 2,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max((r.total / maxTotal) * 100, 2)}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Card>
  );
});

// ------------------------------------------------------------------
// Daily rhythm
// ------------------------------------------------------------------

export const DailyRhythmSection = React.memo(function DailyRhythmSection({
  stats,
  today,
}: {
  stats: Stats;
  today: Date;
}) {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing } = theme;
  const sel = stats.selectedMonth;
  const [selectedDay, setSelectedDay] = useState<number | undefined>();

  useEffect(() => setSelectedDay(undefined), [sel.year, sel.month]);

  const values = useMemo(
    () => dailyDebitMap(stats.dailyBreakdown ?? [], sel.year, sel.month),
    [stats.dailyBreakdown, sel.year, sel.month],
  );
  const proj = useMemo(
    () => projectMonthEnd(stats.summary.totalDebits, sel, today),
    [stats.summary.totalDebits, sel, today],
  );
  // Passing today excludes it (it is not over yet), matching the insight.
  const ns = useMemo(
    () =>
      noSpendStats(
        stats.dailyBreakdown ?? [],
        sel.year,
        sel.month,
        proj.daysElapsed,
        today,
      ),
    [stats.dailyBreakdown, sel, proj.daysElapsed, today],
  );

  const caption =
    selectedDay !== undefined
      ? `${selectedDay} ${MONTH_SHORT[sel.month - 1]}: ${
          (values[selectedDay] ?? 0) > 0
            ? formatCurrency(values[selectedDay])
            : "no spending"
        }`
      : "Tap a day to see its total";

  return (
    <Card>
      <SectionHeader title="Daily rhythm" subtitle="Darker days cost more" />
      <CalendarHeatmap
        year={sel.year}
        month={sel.month}
        values={values}
        selectedDay={selectedDay}
        onDayPress={(d) =>
          setSelectedDay((cur) => (cur === d ? undefined : d))
        }
        formatter={formatCurrency}
      />
      <Text
        accessibilityLiveRegion="polite"
        style={{
          color: selectedDay !== undefined ? colors.text : colors.textTertiary,
          fontSize: fontSize.sm,
          fontWeight:
            selectedDay !== undefined ? fontWeight.semibold : fontWeight.regular,
          marginTop: spacing.md,
        }}
      >
        {caption}
      </Text>
      <View
        style={[
          styles.footerRule,
          { borderTopColor: colors.border, marginTop: spacing.md },
        ]}
      >
        <Ionicons name="leaf-outline" size={16} color={colors.chart.positive} />
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
          {ns.noSpendDays} no-spend {ns.noSpendDays === 1 ? "day" : "days"} ·
          longest streak {ns.longestStreak}
        </Text>
      </View>
    </Card>
  );
});

// ------------------------------------------------------------------
// Weekly pattern
// ------------------------------------------------------------------

const WEEK_ALPHAS = [0.35, 0.5, 0.65, 0.8, 1];
// Sunday-first weekdayTotals index for each Monday-first slot.
const MON_FIRST_SRC = [1, 2, 3, 4, 5, 6, 0];

export const WeeklyPatternSection = React.memo(function WeeklyPatternSection({
  stats,
}: {
  stats: Stats;
}) {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing, borderRadius } = theme;
  const daily = stats.dailyBreakdown;

  const totals = useMemo(() => weekdayTotals(daily ?? []), [daily]);
  const weekend = useMemo(() => weekendShare(daily ?? []), [daily]);
  const weeks = useMemo(() => weekOfMonthTotals(daily ?? []), [daily]);
  const weekdaySummary = useMemo(() => {
    const values = MON_FIRST_SRC.map((src) =>
      Number.isFinite(totals[src]) && totals[src] > 0 ? totals[src] : 0,
    );
    const max = Math.max(...values);
    if (max <= 0) return "No weekday spending data";
    const parts = WEEKDAY_SHORT_MON_FIRST.map(
      (d, i) => `${d} ${formatCurrency(values[i])}`,
    ).join(", ");
    return `Spending by weekday. ${parts}. Peak day ${
      WEEKDAY_SHORT_MON_FIRST[values.indexOf(max)]
    }`;
  }, [totals]);
  const weekSum = weeks.reduce((a, b) => a + b, 0);
  const ramp = WEEK_ALPHAS.map((a) => withAlpha(colors.chart.spend, a));

  return (
    <Card>
      <SectionHeader
        title="Weekly pattern"
        subtitle="When your money moves"
      />
      {/* Bar labels are compact; the spoken summary keeps full amounts. */}
      <View accessible accessibilityLabel={weekdaySummary}>
        <View importantForAccessibility="no-hide-descendants">
          <WeekdayBars
            totals={totals}
            highlightWeekend
            formatter={formatAxisAmount}
          />
        </View>
      </View>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.sm,
          marginTop: spacing.md,
        }}
      >
        Weekends:{" "}
        <Text style={{ color: colors.text, fontWeight: fontWeight.bold }}>
          {weekend !== null ? pct(weekend) : "—"}
        </Text>
        {weekend !== null ? " of spending" : ""}
      </Text>

      <View
        style={[
          styles.footerRule,
          {
            borderTopColor: colors.border,
            marginTop: spacing.md,
            paddingTop: spacing.md,
            flexDirection: "column",
            alignItems: "stretch",
            gap: spacing.sm,
          },
        ]}
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
          }}
        >
          Week of the month
        </Text>
        {weekSum > 0 ? (
          <>
            <View
              style={[
                styles.weekBar,
                { backgroundColor: colors.chart.track, borderRadius: borderRadius.full },
              ]}
              accessible
              accessibilityLabel={`Spending by week of month: ${weeks
                .map((w, i) => `week ${i + 1} ${pct((w / weekSum) * 100)}`)
                .join(", ")}`}
            >
              {weeks.map((w, i) =>
                w > 0 ? (
                  <View
                    key={i}
                    style={{
                      flex: w,
                      backgroundColor: ramp[i],
                      marginLeft: i === 0 ? 0 : 2,
                    }}
                  />
                ) : null,
              )}
            </View>
            <View style={styles.row}>
              {weeks.map((w, i) => (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: ramp[i] },
                    ]}
                  />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: fontSize.xs,
                      marginTop: 2,
                    }}
                  >
                    W{i + 1}
                  </Text>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {pct((w / weekSum) * 100)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={{ color: colors.textTertiary, fontSize: fontSize.sm }}>
            No spending to split yet.
          </Text>
        )}
      </View>
    </Card>
  );
});

// ------------------------------------------------------------------
// 12-month trend
// ------------------------------------------------------------------

export const TrendSection = React.memo(function TrendSection({
  stats,
  today,
}: {
  stats: Stats;
  today: Date;
}) {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing } = theme;
  const trend = stats.monthlyTrend;
  const sel = stats.selectedMonth;

  // Exactly 12 bars ending at the selected month, gaps zero-filled.
  const data = useMemo(
    () =>
      zeroFillTrend(trend ?? [], sel).map((t) => ({
        label: t.label,
        income: t.creditTotal,
        spend: t.debitTotal,
      })),
    [trend, sel],
  );
  const { bestNet, worstNet } = useMemo(
    // Skips the current, still-partial month.
    () => bestWorstMonth(trend ?? [], today),
    [trend, today],
  );

  const fmt = (m: { monthNum: number; year: number; net: number }) =>
    `${MONTH_SHORT[m.monthNum - 1]} ${String(m.year).slice(2)} (${
      m.net < 0 ? "-" : "+"
    }${formatCurrency(Math.abs(m.net))})`;

  const showBestWorst =
    bestNet && worstNet && (bestNet.monthNum !== worstNet.monthNum || bestNet.year !== worstNet.year);

  return (
    <Card>
      <SectionHeader
        title="12-month trend"
        subtitle="Income above, spending below"
      />
      <DivergingBars data={data} height={200} formatter={formatCurrency} />
      <View style={[styles.legendRow, { marginTop: spacing.sm }]}>
        <LegendDot color={colors.chart.income} label="Income" />
        <LegendDot color={colors.chart.spend} label="Spent" />
      </View>
      {showBestWorst ? (
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Ionicons
              name="trophy-outline"
              size={16}
              color={colors.chart.positive}
            />
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 }}>
              Best month{" "}
              <Text style={{ color: colors.text, fontWeight: fontWeight.semibold }}>
                {fmt(bestNet)}
              </Text>
            </Text>
          </View>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={colors.chart.negative}
            />
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 }}>
              Toughest month{" "}
              <Text style={{ color: colors.text, fontWeight: fontWeight.semibold }}>
                {fmt(worstNet)}
              </Text>
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
});

// ------------------------------------------------------------------
// Big tickets
// ------------------------------------------------------------------

export const BigTicketsSection = React.memo(function BigTicketsSection({
  stats,
}: {
  stats: Stats;
}) {
  const { theme } = useTheme();
  const { colors, fontSize, fontWeight, spacing, borderRadius } = theme;

  const items = useMemo(
    () =>
      (stats.top5Expenses ?? [])
        .filter((e) => e.type !== "credit" && Number.isFinite(e.amount))
        .slice(0, 5),
    [stats.top5Expenses],
  );
  const max = Math.max(1, ...items.map((e) => e.amount));
  const spend = stats.summary.totalDebits;
  const largestShare =
    items.length > 0 && spend > 0 ? (items[0].amount / spend) * 100 : null;

  return (
    <Card>
      <SectionHeader
        title="Big tickets"
        subtitle={
          largestShare !== null
            ? `Your largest expense was ${pct(largestShare)} of the month`
            : "Your largest expenses"
        }
      />
      {items.length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
          No expenses this month.
        </Text>
      ) : (
        <View style={{ gap: spacing.md }}>
          {items.map((e, i) => (
            <View key={e._id} style={[styles.row, { gap: spacing.md }]}>
              <View
                style={[
                  styles.rank,
                  { backgroundColor: colors.chart.track },
                ]}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {i + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.row, { justifyContent: "space-between", gap: spacing.sm }]}>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: fontSize.md,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {e.remarks || e.category || "Uncategorized"}
                  </Text>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: fontSize.md,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {formatCurrency(e.amount)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: colors.chart.track, marginTop: 6 },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max((e.amount / max) * 100, 3)}%`,
                        backgroundColor: colors.chart.spend,
                      },
                    ]}
                  />
                </View>
                <View style={[styles.row, { gap: spacing.sm, marginTop: 6 }]}>
                  <View
                    style={{
                      backgroundColor: colors.chart.track,
                      borderRadius: borderRadius.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.textSecondary,
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                      }}
                    >
                      {expenseCategoryOf(e)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: fontSize.xs,
                    }}
                  >
                    {formatDate(e.date, "DD MMM")}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
});

// ------------------------------------------------------------------

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  dashRow: { flexDirection: "row", gap: 2 },
  dash: { width: 5, height: 2, borderRadius: 1 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  deltaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  footerRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  weekBar: { height: 14, flexDirection: "row", overflow: "hidden" },
  rank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
