import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import type { IAvailableMonth } from "../../types";
import {
  MONTH_SHORT,
  isSameMonth,
  monthLabel,
  stepMonth,
  yearGrid,
} from "../../utils/months";

export interface MonthSelectorProps {
  months: IAvailableMonth[]; // already includes the current month
  selected: { year: number; month: number };
  onChange: (ym: { year: number; month: number }) => void;
  loading?: boolean; // show a small ActivityIndicator in place of the caption
}

// Text on the primary fill is white in both themes (primary is the same
// indigo in light and dark; textInverse flips to near-black in dark mode).
const ON_PRIMARY = "#FFFFFF";
const ON_PRIMARY_SOFT = "rgba(255,255,255,0.25)";

const MonthSelector: React.FC<MonthSelectorProps> = ({
  months,
  selected,
  onChange,
  loading = false,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs, borderRadius: br, spacing } = theme;
  const [sheetOpen, setSheetOpen] = useState(false);

  const prev = useMemo(
    () => stepMonth(months, selected, -1),
    [months, selected],
  );
  const next = useMemo(() => stepMonth(months, selected, 1), [months, selected]);
  // Recomputed each time the sheet opens so the "current month" marker is fresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const grid = useMemo(() => yearGrid(months, new Date()), [months, sheetOpen]);

  const selectedCount = useMemo(() => {
    const m = months.find((x) => isSameMonth(x, selected));
    return m ? m.txCount : 0;
  }, [months, selected]);

  const caption =
    selectedCount === 0
      ? "No transactions yet"
      : `${selectedCount} transaction${selectedCount === 1 ? "" : "s"}`;

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const tick = useCallback(() => {
    // Haptics may be unavailable; selectionAsync rejects asynchronously.
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const handlePick = useCallback(
    (year: number, month: number) => {
      tick();
      setSheetOpen(false);
      onChange({ year, month });
    },
    [onChange, tick],
  );

  const renderArrow = (
    dir: "prev" | "next",
    target: IAvailableMonth | null,
  ) => {
    const disabled = !target;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir === "prev" ? "Previous month" : "Next month"}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          if (!target) return;
          tick();
          onChange({ year: target.year, month: target.month });
        }}
        style={({ pressed }) => [
          styles.arrow,
          {
            opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
            backgroundColor: pressed ? colors.primarySurface : "transparent",
            borderRadius: br.md,
          },
        ]}
      >
        <Ionicons
          name={dir === "prev" ? "chevron-back" : "chevron-forward"}
          size={22}
          color={colors.text}
        />
      </Pressable>
    );
  };

  return (
    <>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: br.lg,
            marginHorizontal: spacing.lg,
          },
        ]}
      >
        {renderArrow("prev", prev)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose month, ${monthLabel(selected, "long")}, ${caption}`}
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [
            styles.center,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <View style={styles.centerText}>
            <Text
              numberOfLines={1}
              style={[styles.label, { color: colors.text, fontSize: fs.lg }]}
            >
              {monthLabel(selected, "long")}
            </Text>
            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.textSecondary}
                style={styles.spinner}
              />
            ) : (
              <Text
                numberOfLines={1}
                style={[
                  styles.caption,
                  { color: colors.textSecondary, fontSize: fs.xs },
                ]}
              >
                {caption}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </Pressable>

        {renderArrow("next", next)}
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <Pressable
          accessible={false}
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          onPress={closeSheet}
        >
          <Pressable
            accessible={false}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: br.xl,
                borderTopRightRadius: br.xl,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.sheetHeader,
                { borderBottomColor: colors.border, padding: spacing.lg },
              ]}
            >
              <Text
                style={[
                  styles.sheetTitle,
                  { color: colors.text, fontSize: fs.xl },
                ]}
              >
                Choose month
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={closeSheet}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.xxl,
              }}
              showsVerticalScrollIndicator={false}
            >
              {grid.map(({ year, cells }) => (
                <View key={year} style={styles.yearBlock}>
                  <Text
                    style={[
                      styles.yearTitle,
                      { color: colors.textSecondary, fontSize: fs.sm },
                    ]}
                  >
                    {year}
                  </Text>
                  <View style={styles.monthGrid}>
                    {cells.map((cell) => {
                      const isSelected = isSameMonth(
                        { year, month: cell.month },
                        selected,
                      );
                      return (
                        <View key={cell.month} style={styles.cellSlot}>
                          <Pressable
                            disabled={!cell.enabled}
                            accessibilityRole="button"
                            accessibilityLabel={`${monthLabel(
                              { year, month: cell.month },
                              "long",
                            )}${
                              cell.enabled && cell.count > 0
                                ? `, ${cell.count} transaction${cell.count === 1 ? "" : "s"}`
                                : ""
                            }${cell.isCurrent ? ", current month" : ""}`}
                            accessibilityState={{
                              disabled: !cell.enabled,
                              selected: isSelected,
                            }}
                            onPress={() => handlePick(year, cell.month)}
                            style={({ pressed }) => [
                              styles.cell,
                              {
                                borderRadius: br.md,
                                backgroundColor: isSelected
                                  ? colors.primary
                                  : colors.surface,
                                borderColor: isSelected
                                  ? colors.primary
                                  : colors.border,
                                opacity: !cell.enabled
                                  ? 0.35
                                  : pressed
                                    ? 0.7
                                    : 1,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.cellText,
                                {
                                  color: isSelected ? ON_PRIMARY : colors.text,
                                  fontSize: fs.md,
                                },
                              ]}
                            >
                              {MONTH_SHORT[cell.month - 1]}
                            </Text>
                            {cell.enabled && cell.count > 0 && (
                              <View
                                style={[
                                  styles.badge,
                                  {
                                    backgroundColor: isSelected
                                      ? ON_PRIMARY_SOFT
                                      : colors.primarySurface,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.badgeText,
                                    {
                                      color: isSelected
                                        ? ON_PRIMARY
                                        : colors.primary,
                                      fontSize: fs.xs,
                                    },
                                  ]}
                                >
                                  {cell.count}
                                </Text>
                              </View>
                            )}
                            {cell.isCurrent && (
                              <View
                                style={[
                                  styles.nowDot,
                                  {
                                    backgroundColor: isSelected
                                      ? ON_PRIMARY
                                      : colors.primary,
                                  },
                                ]}
                              />
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginVertical: 8,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  centerText: { alignItems: "center", flexShrink: 1 },
  label: { fontWeight: "600" },
  caption: { marginTop: 1 },
  spinner: { height: 14, marginTop: 1, transform: [{ scale: 0.7 }] },
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "80%", paddingBottom: 12 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontWeight: "700" },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
  yearBlock: { marginTop: 16 },
  yearTitle: {
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  cellSlot: { width: "25%", padding: 4 },
  cell: {
    height: 56,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontWeight: "600" },
  badge: {
    marginTop: 2,
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: 8,
    alignItems: "center",
  },
  badgeText: { fontWeight: "700" },
  nowDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default React.memo(MonthSelector);
