import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Keyboard,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { EMPTY_EXPENSE_FILTERS } from "../../constants/expenseFilters";
import {
  amountRangeError,
  parseAmountInput,
} from "../../utils/expenseFilters";
import { categoryKey } from "../../utils/expenseCategories";
import { readableOn } from "../../utils/chartPalette";
import type { ExpenseFilters, IExpenseCategory } from "../../types";

// Text on coloured fills stays white; the theme has no on-primary token.
const ON_ACCENT = "#FFFFFF";
// The server takes at most 10 category names in one search.
const MAX_CATEGORIES = 10;
// Room for "1,00,00,000.00" and a little more.
const AMOUNT_MAX_LENGTH = 15;
// Largest text scale for segment labels. On two lines, "Money" / "out" and
// "All" / "months" still fit a third of a 320 pt wide sheet at this size.
const SEGMENT_MAX_FONT_SCALE = 1.5;
// Space kept between the sheet and the status bar while the keyboard is up.
const TOP_GAP = 8;
const BAD_AMOUNT = "Enter a number";

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
 * Typed amount text the search can't use ("1e3", "12..5", "-5"). Blank text
 * is fine: it means no limit. Same rule as the request (parseAmountInput),
 * so a value the sheet accepts is never dropped from the search.
 */
const isBadAmount = (text: string): boolean =>
  text.trim() !== "" && parseAmountInput(text) === undefined;

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

  // Plain primary is under 4.5:1 for text on the sheet, on the selected chip
  // tint and under white text. The dark accent is used on light colours and
  // the light accent on dark ones (5.6:1 / 5.4:1 on the tint, 6.0:1 / 6.7:1
  // on the sheet), and filled controls use primaryDark (white on it is
  // 6.3:1 light, 7.9:1 dark).
  const accentOnTint = readableOn(colors.primarySurface, [
    colors.primaryDark,
    colors.primaryLight,
  ]);
  const accentOnSheet = readableOn(colors.background, [
    colors.primaryDark,
    colors.primaryLight,
  ]);
  const accentFill = colors.primaryDark;

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
  // only hears keyboards that open while it is showing.
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  /**
   * Keep the amount fields and "Apply filters" above the keyboard.
   *
   * The app draws edge to edge, so on Android the modal's window doesn't
   * shrink for the keyboard, and a KeyboardAvoidingView inside a Modal often
   * gets no usable keyboard frame. As on AddEditExpenseScreen, the keyboard
   * events give its height instead. The sheet takes it as bottom padding, so
   * the footer sits on top of the keyboard; the sheet may then grow up to the
   * status bar, and the filter list, the only part that shrinks, scrolls in
   * what is left, with the amounts scrolled into view.
   */
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Height of the modal's window, from the overlay's layout.
  const [windowHeight, setWindowHeight] = useState(0);
  // Top of the Amount section inside the scrolling content, from onLayout.
  const amountY = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
      // A hide event after closing isn't heard any more.
      setKeyboardHeight(0);
    };
  }, [visible]);

  // Scroll once the padding is committed, or the scroll is clamped to the
  // list's height from before the keyboard. Height goes back to 0 on hide, so
  // every opening of the keyboard runs this again.
  useEffect(() => {
    const y = amountY.current;
    if (keyboardHeight === 0 || y === null) return;
    const frame = requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [keyboardHeight]);

  // Height the keyboard covers at the bottom of the window. Android reports
  // it without the navigation bar below it, which edge to edge is covered
  // too; on iOS it already includes the home-indicator area.
  const keyboardInset =
    keyboardHeight > 0
      ? keyboardHeight + (Platform.OS === "android" ? insets.bottom : 0)
      : 0;
  const keyboardOpen = keyboardInset > 0;
  const sheetMaxHeight =
    keyboardOpen && windowHeight > 0
      ? windowHeight - insets.top - TOP_GAP
      : "85%";

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

  const minBad = isBadAmount(draft.minAmount);
  const maxBad = isBadAmount(draft.maxAmount);
  // Only set when both bounds parse, so never together with minBad/maxBad.
  const rangeError = amountRangeError(draft);
  const canApply = !minBad && !maxBad && rangeError === null;

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
    if (!canApply) return;
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
            style={[styles.segment, active && { backgroundColor: accentFill }]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
          >
            {/* Wraps to a second line rather than cutting "Money out". */}
            <Text
              style={[
                styles.segmentText,
                { color: active ? ON_ACCENT : colors.textSecondary },
              ]}
              numberOfLines={2}
              maxFontSizeMultiplier={SEGMENT_MAX_FONT_SCALE}
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
          { color: selected ? accentOnTint : colors.textSecondary },
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

  const renderBadAmount = (field: string) => (
    <Text
      style={[styles.error, { color: colors.danger }]}
      accessibilityLabel={`${field}: ${BAD_AMOUNT.toLowerCase()}`}
      accessibilityLiveRegion="polite"
    >
      {BAD_AMOUNT}
    </Text>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Not an accessibility element itself, so screen readers still reach
          the controls inside; back and escape close the sheet. */}
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        onLayout={(e) => setWindowHeight(e.nativeEvent.layout.height)}
        accessible={false}
        onAccessibilityEscape={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              maxHeight: sheetMaxHeight,
              paddingBottom: (keyboardOpen ? keyboardInset : insets.bottom) + 12,
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
              <Text style={[styles.resetText, { color: accentOnSheet }]}>
                Reset
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
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

            <View
              style={styles.section}
              onLayout={(e) => {
                amountY.current = e.nativeEvent.layout.y;
              }}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Amount
              </Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={amountInputStyle(minBad)}
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
                  style={amountInputStyle(maxBad || rangeError !== null)}
                  value={draft.maxAmount}
                  onChangeText={(maxAmount) => update({ maxAmount })}
                  keyboardType="decimal-pad"
                  placeholder="Max ₹"
                  placeholderTextColor={colors.inputPlaceholder}
                  maxLength={AMOUNT_MAX_LENGTH}
                  accessibilityLabel="Maximum amount"
                />
              </View>
              {(minBad || maxBad) && (
                // Laid out like the row above (an invisible "to" keeps the
                // widths), so each message sits under its own field.
                <View style={styles.amountErrorRow}>
                  <View style={styles.amountCell}>
                    {minBad && renderBadAmount("Minimum amount")}
                  </View>
                  <Text
                    style={[styles.to, styles.invisible]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    to
                  </Text>
                  <View style={styles.amountCell}>
                    {maxBad && renderBadAmount("Maximum amount")}
                  </View>
                </View>
              )}
              {rangeError !== null && (
                <Text
                  style={[styles.error, { color: colors.danger }]}
                  accessibilityLiveRegion="polite"
                >
                  {rangeError}
                </Text>
              )}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.applyButton,
                { backgroundColor: accentFill },
                !canApply && styles.disabled,
              ]}
              onPress={apply}
              disabled={!canApply}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
              accessibilityState={{ disabled: !canApply }}
            >
              <Text style={styles.applyText} numberOfLines={1}>
                Apply filters
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  // maxHeight and paddingBottom are set inline: both follow the keyboard.
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  segmented: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  // minWidth 0 keeps a long label inside its third of the row.
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  segmentText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
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
  amountErrorRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  amountCell: { flex: 1, minWidth: 0 },
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
  invisible: { opacity: 0 },
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
