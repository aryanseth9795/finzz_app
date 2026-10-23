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
import type { ExpenseFilterChip, ExpenseSearchSummary } from "../../types";

interface ActiveFilterRowProps {
  chips: ExpenseFilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  summary: ExpenseSearchSummary | null; // null until the first reply
  loading: boolean;
}

/**
 * The active filters as removable chips, then one line with the number of
 * matches and their totals. The totals cover everything that matches, not
 * just the rows loaded so far.
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

  const debit = summary?.debitTotal ?? 0;
  const credit = summary?.creditTotal ?? 0;
  const totalsLabel = [
    debit > 0 ? `Money out ₹${formatNumber(debit)}` : "",
    credit > 0 ? `money in ₹${formatNumber(credit)}` : "",
  ]
    .filter(Boolean)
    .join(", ");

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
            {chips.map((chip) => (
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.primarySurface,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => onRemove(chip.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${chip.label} filter`}
              >
                <Text
                  style={[styles.chipText, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {chip.label}
                </Text>
                <Ionicons name="close" size={14} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.clearAll}
            onPress={onClearAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text
              style={[styles.clearAllText, { color: colors.primary }]}
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
              accessibilityLabel={totalsLabel}
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
