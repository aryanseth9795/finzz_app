import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { formatNumber } from "../../utils/money";
import { readableOn } from "../../utils/chartPalette";
import { totalsLabel } from "../../utils/expenseFilters";
import type { ExpenseFilterChip, ExpenseSearchSummary } from "../../types";

interface ActiveFilterRowProps {
  chips: ExpenseFilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  summary: ExpenseSearchSummary | null; // null until the first reply
  loading: boolean;
}

/**
 * The active filters as chips, then one line with the number of matches and
 * their totals. A chip with `removable: false` (the month a month-scoped
 * search covers) only informs: no ✕ and not a button. "Clear all" still
 * clears everything. The totals cover everything that matches, not just the
 * rows loaded so far.
 */
export default function ActiveFilterRow({
  chips,
  onRemove,
  onClearAll,
  summary,
  loading,
}: ActiveFilterRowProps): React.JSX.Element | null {
  const { theme } = useTheme();
  const { colors } = theme;

  const showSummary = summary !== null || loading;
  if (chips.length === 0 && !showSummary) return null;

  // Brand text that reaches 4.5:1: `primary` is ~4.0:1 on the chip fill in
  // light and ~3.6:1 in dark, so take the stronger indigo for each theme
  // (primaryDark in light, primaryLight in dark).
  const brandInks = [colors.primaryDark, colors.primaryLight];
  const chipInk = readableOn(colors.primarySurface, brandInks);
  const clearAllInk = readableOn(colors.background, brandInks);

  const debit = summary?.debitTotal ?? 0;
  const credit = summary?.creditTotal ?? 0;
  const totalsA11yLabel = totalsLabel(debit, credit);

  return (
    <View style={styles.container}>
      {chips.length > 0 && (
        <View style={styles.chipLine}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContent}
            keyboardShouldPersistTaps="handled"
          >
            {chips.map((chip) => {
              const chipColors = {
                backgroundColor: colors.primarySurface,
                borderColor: colors.primary,
              };
              const label = (
                <Text
                  style={[styles.chipText, { color: chipInk }]}
                  numberOfLines={1}
                >
                  {chip.label}
                </Text>
              );

              if (chip.removable === false) {
                return (
                  <View
                    key={chip.key}
                    style={[styles.chip, styles.chipInfo, chipColors]}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={`Showing ${chip.label}`}
                  >
                    {label}
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.chip, chipColors]}
                  onPress={() => onRemove(chip.key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${chip.label} filter`}
                >
                  {label}
                  <Ionicons name="close" size={14} color={chipInk} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={styles.clearAll}
            onPress={onClearAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text
              style={[styles.clearAllText, { color: clearAllInk }]}
              numberOfLines={1}
            >
              Clear all
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showSummary && (
        <View style={styles.summaryLine}>
          <Text
            style={[styles.count, { color: colors.textSecondary }]}
            numberOfLines={1}
            accessibilityLiveRegion="polite"
          >
            {summary
              ? `${formatNumber(summary.count)} ${summary.count === 1 ? "result" : "results"}`
              : "Searching…"}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : debit > 0 || credit > 0 ? (
            <Text
              style={[styles.totals, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              accessibilityLabel={totalsA11yLabel}
            >
              {debit > 0 ? `−₹${formatNumber(debit)}` : ""}
              {debit > 0 && credit > 0 ? "  " : ""}
              {credit > 0 ? (
                <Text style={{ color: colors.credit }}>
                  +₹{formatNumber(credit)}
                </Text>
              ) : null}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Never squeezed by the list below it.
  container: { flexShrink: 0, paddingTop: 6 },
  chipLine: { flexDirection: "row", alignItems: "center" },
  chipScroll: { flex: 1 },
  chipContent: {
    alignItems: "center",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 5,
  },
  // No ✕ on an informational chip, so even padding on both sides.
  chipInfo: { paddingRight: 12 },
  // A long search text ellipsizes instead of filling the row.
  chipText: { maxWidth: 180, fontSize: 13, fontWeight: "500" },
  clearAll: { flexShrink: 0, paddingLeft: 8, paddingRight: 16 },
  clearAllText: { fontSize: 13, fontWeight: "600" },
  summaryLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 28,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  // The count is short and keeps its width; long totals shrink to fit.
  count: { flexShrink: 0, maxWidth: "50%", fontSize: 13, fontWeight: "600" },
  totals: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
