import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { EMPTY_EXPENSE_FILTERS } from "../../constants/expenseFilters";
import type { ExpenseFilters, IExpenseCategory } from "../../types";

// Text on coloured fills stays white; the theme has no on-primary token.
const ON_ACCENT = "#FFFFFF";
// The server takes at most 10 category names in one search.
const MAX_CATEGORIES = 10;
// Room for "1,00,00,000.00" and a little more.
const AMOUNT_MAX_LENGTH = 15;

interface Option<T extends string> {
  key: T;
  label: string;
}

const TYPE_OPTIONS: Option<ExpenseFilters["type"]>[] = [
  { key: "all", label: "All" },
  { key: "debit", label: "Money out" },
  { key: "credit", label: "Money in" },
];

/**
 * A typed amount as a number: commas are ignored, and blank or unusable text
 * (letters, a negative number) counts as no limit.
 */
const parseAmountText = (text: string): number | null => {
  const cleaned = text.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/** A category name as the server compares it: case and spacing ignored. */
const categoryKey = (name: string): string =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

const copyFilters = (f: ExpenseFilters): ExpenseFilters => ({
  ...f,
  categories: [...f.categories],
});

interface ExpenseFilterSheetProps {
  visible: boolean;
  initial: ExpenseFilters; // copied into the draft each time the sheet opens
  categories: IExpenseCategory[]; // the saved suggestions, debit and credit
  monthName: string; // label of the "month" scope, e.g. "Oct 2026"
  onApply: (f: ExpenseFilters) => void;
  onClose: () => void;
}

/**
 * The filter sheet. It edits a draft copy of the filters, so nothing changes
 * on the list until "Apply filters"; closing the sheet any other way drops
 * the draft.
 */
export default function ExpenseFilterSheet({
  visible,
  initial,
  categories,
  monthName,
  onApply,
  onClose,
}: ExpenseFilterSheetProps): React.JSX.Element {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<ExpenseFilters>(() =>
    copyFilters(initial),
  );
  // Re-initialise the draft on every opening, during render rather than in
  // an effect, so the first frame of the slide-in already shows it.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(copyFilters(initial));
  }

  // A keyboard left open by the search bar would cover the sheet: the sheet
  // only moves for keyboards that open while it is showing.
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  /**
   * Chip names: the saved categories with debit and credit merged, plus any
   * category that is filtered on but no longer saved (a report tap can open
   * one), so it can still be unselected. Names from `initial` stay listed
   * after being unselected, so a chip never vanishes under the finger.
   */
  const categoryNames = useMemo(() => {
    const byKey = new Map<string, string>();
    const add = (name: string) => {
      const key = categoryKey(name);
      if (key && !byKey.has(key)) byKey.set(key, name.trim());
    };
    categories.forEach((c) => add(c.name));
    initial.categories.forEach(add);
    draft.categories.forEach(add);
    return [...byKey.values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [categories, initial.categories, draft.categories]);

  const selectedKeys = useMemo(
    () => new Set(draft.categories.map(categoryKey)),
    [draft.categories],
  );
  const atCategoryLimit = selectedKeys.size >= MAX_CATEGORIES;

  const min = parseAmountText(draft.minAmount);
  const max = parseAmountText(draft.maxAmount);
  const rangeError = min !== null && max !== null && max < min;

  const update = (patch: Partial<ExpenseFilters>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const toggleCategory = (name: string) => {
    const key = categoryKey(name);
    setDraft((d) => {
      const keys = new Set(d.categories.map(categoryKey));
      const selected = keys.has(key);
      if (!selected && keys.size >= MAX_CATEGORIES) return d;
      return {
        ...d,
        categories: selected
          ? d.categories.filter((c) => categoryKey(c) !== key)
          : [...d.categories, name],
      };
    });
  };

  // Everything back to "no filters"; the search text belongs to the search
  // bar, so it stays.
  const reset = () =>
    setDraft((d) => ({ ...copyFilters(EMPTY_EXPENSE_FILTERS), q: d.q }));

  const apply = () => {
    if (rangeError) return;
    Keyboard.dismiss();
    onApply(copyFilters(draft));
    onClose();
  };

  const monthLabel = monthName.trim() || "This month";
  const scopeOptions: Option<ExpenseFilters["scope"]>[] = [
    { key: "month", label: monthLabel },
    { key: "all", label: "All months" },
  ];

  const renderSegmented = <T extends string>(
    options: Option<T>[],
    value: T,
    onChange: (key: T) => void,
  ) => (
    <View
      style={[
        styles.segmented,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            style={[
              styles.segment,
              active && { backgroundColor: colors.primary },
            ]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? ON_ACCENT : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderChip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    disabled = false,
  ) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.chip,
        selected
          ? {
              backgroundColor: colors.primarySurface,
              borderColor: colors.primary,
            }
          : {
              backgroundColor: colors.surface,
              borderColor: colors.inputBorder,
            },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.primary : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const amountInputStyle = (hasError: boolean) => [
    styles.amountInput,
    {
      backgroundColor: colors.inputBackground,
      borderColor: hasError ? colors.danger : colors.inputBorder,
      color: colors.text,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* The app draws edge to edge, so the window doesn't shrink for the
          keyboard; this lifts the sheet above it instead. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Not an accessibility element itself, so screen readers still
            reach the controls inside; back and escape close the sheet. */}
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessible={false}
          onAccessibilityEscape={onClose}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + 12,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
            accessible={false}
          >
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text
                style={[styles.title, { color: colors.text }]}
                accessibilityRole="header"
              >
                Filters
              </Text>
              <TouchableOpacity
                onPress={reset}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Reset filters"
              >
                <Text style={[styles.resetText, { color: colors.primary }]}>
                  Reset
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Show
                </Text>
                {renderSegmented(TYPE_OPTIONS, draft.type, (type) =>
                  update({ type }),
                )}
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Months
                </Text>
                {renderSegmented(scopeOptions, draft.scope, (scope) =>
                  update({ scope }),
                )}
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Category
                </Text>
                <View style={styles.chipRow}>
                  {categoryNames.map((name) => {
                    const selected = selectedKeys.has(categoryKey(name));
                    return renderChip(
                      `c:${categoryKey(name)}`,
                      name,
                      selected,
                      () => toggleCategory(name),
                      !selected && atCategoryLimit,
                    );
                  })}
                  {renderChip(
                    "uncategorized",
                    "No category",
                    draft.uncategorized,
                    () => update({ uncategorized: !draft.uncategorized }),
                  )}
                </View>
                {atCategoryLimit && (
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    You can pick up to {MAX_CATEGORIES} categories.
                  </Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Amount
                </Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={amountInputStyle(false)}
                    value={draft.minAmount}
                    onChangeText={(minAmount) => update({ minAmount })}
                    keyboardType="decimal-pad"
                    placeholder="Min ₹"
                    placeholderTextColor={colors.inputPlaceholder}
                    maxLength={AMOUNT_MAX_LENGTH}
                    accessibilityLabel="Minimum amount"
                  />
                  <Text style={[styles.to, { color: colors.textSecondary }]}>
                    to
                  </Text>
                  <TextInput
                    style={amountInputStyle(rangeError)}
                    value={draft.maxAmount}
                    onChangeText={(maxAmount) => update({ maxAmount })}
                    keyboardType="decimal-pad"
                    placeholder="Max ₹"
                    placeholderTextColor={colors.inputPlaceholder}
                    maxLength={AMOUNT_MAX_LENGTH}
                    accessibilityLabel="Maximum amount"
                  />
                </View>
                {rangeError && (
                  <Text
                    style={[styles.error, { color: colors.danger }]}
                    accessibilityLiveRegion="polite"
                  >
                    Max must be at least min
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.applyButton,
                  { backgroundColor: colors.primary },
                  rangeError && styles.disabled,
                ]}
                onPress={apply}
                disabled={rangeError}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Apply filters"
                accessibilityState={{ disabled: rangeError }}
              >
                <Text style={styles.applyText} numberOfLines={1}>
                  Apply filters
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { flexShrink: 1, fontSize: 18, fontWeight: "700" },
  resetText: { fontSize: 15, fontWeight: "600" },
  // Sizes to its content and shrinks (then scrolls) when the sheet is full.
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  segmented: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  // minWidth 0 lets a long month label ellipsize instead of widening the row.
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  segmentText: { fontSize: 14, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  hint: { fontSize: 12, marginTop: 8 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  amountInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  to: { fontSize: 14 },
  error: { fontSize: 13, marginTop: 6 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  applyButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  applyText: { color: ON_ACCENT, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
