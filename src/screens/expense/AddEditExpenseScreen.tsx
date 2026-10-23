import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { useAppDispatch } from "../../store";
import { addExpense, updateExpense } from "../../store/slices/expenseSlice";
import {
  addExpenseApi,
  editExpenseApi,
  checkDuplicateExpenseApi,
} from "../../api/expenseApi";
import { describeError } from "../../api/axios";
import { cacheManager, CACHE_KEYS } from "../../utils/cacheManager";
import { parseAmount, formatCurrency } from "../../utils/money";
import {
  toApiDate,
  fromApiDate,
  formatDate,
  pickerMinimumDate,
  pickerMaximumDate,
} from "../../utils/dates";
import {
  normalizeCategoryName,
  isStorableCategory,
  chipsFor,
  findCategory,
  isNewCategory,
  resolveSpelling,
  categoryChangedOnEdit,
} from "../../utils/expenseCategories";
import {
  readSavedCategories,
  subscribeCategories,
  ensureCategories,
  applyCategoryReply,
  removeExpenseCategory,
} from "../../utils/expenseCategorySync";
import {
  IExpense,
  IExpenseCategory,
  ExpenseCategoriesCache,
  ExpenseCategoryReply,
} from "../../types";
import CategoryChips from "./CategoryChips";

// Text/icons on coloured fills stay white; the theme has no on-primary token.
const ON_ACCENT = "#FFFFFF";

const AddEditExpenseScreen = ({ route, navigation }: any) => {
  const { expense, ledgerId } = route.params || {};
  const isEditing = !!expense;

  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const { showSuccessToast } = useToast();
  const dispatch = useAppDispatch();

  const [amount, setAmount] = useState(expense?.amount?.toString() || "");
  const [txnType, setTxnType] = useState<"debit" | "credit">(
    expense?.type || "debit",
  );
  // `fromApiDate` reads UTC components, so a stored UTC-midnight value is not
  // shifted back onto the previous day by the device's timezone.
  const [date, setDate] = useState(
    expense ? fromApiDate(expense.date) : new Date(),
  );
  const [remarks, setRemarks] = useState(expense?.remarks || "");
  const [category, setCategory] = useState(expense?.category || "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cache, setCache] = useState<ExpenseCategoriesCache | null>(null);

  // The screen reads only the saved category list. `ensureCategories` fetches
  // it once when there is none: offline at launch, or a fresh login, which
  // doesn't run the launch sync.
  useEffect(() => {
    let active = true;
    // A write that lands first is newer than the read, so the read yields.
    let heard = false;
    readSavedCategories().then((saved) => {
      if (active && !heard) setCache(saved);
    });
    const unsubscribe = subscribeCategories((next) => {
      heard = true;
      setCache(next);
    });
    void ensureCategories();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const list = useMemo(() => cache?.categories ?? [], [cache]);
  const chips = useMemo(
    () => chipsFor(list, txnType, category),
    [list, txnType, category],
  );
  const selectedId = findCategory(list, txnType, category)?._id ?? null;

  // Never rejects: CategoryChips doesn't await it. On failure the chip stays.
  const handleRemoveCategory = async (c: IExpenseCategory) => {
    try {
      await removeExpenseCategory(c);
    } catch (error) {
      Alert.alert("Could not remove", describeError(error));
    }
  };

  /**
   * Save an expense.
   *
   * THE BUG THIS REPLACES
   * The previous flow was ordered:
   *
   *     dispatch(addExpense(tempExpense));   // optimistic insert
   *     showSuccessToast("Expense added!");  // tell the user it worked
   *     navigation.goBack();                 // leave the screen
   *     await addExpenseApi(expenseData);    // …then actually save it
   *
   * The success toast and the navigation both fired BEFORE the request. On a
   * failure the user had already been told it worked, had already left the
   * form, and their input was gone — while a `temp_…` row sat in Redux
   * rendering as a real expense until the next refetch silently deleted it.
   *
   * In a personal-finance ledger, the user's belief that an expense was
   * recorded is the entire product. The screen now stays mounted until the
   * server confirms, so a failure keeps the user on the form with their input
   * intact and an actionable message.
   */
  const handleSave = async () => {
    const parsed = parseAmount(amount);
    if (!parsed.ok) {
      Alert.alert("Invalid Amount", parsed.message);
      return;
    }

    // Category fields (spec table 6.3), built once here so the "Add anyway"
    // path after the duplicate check sends exactly the same data.
    const normalized = normalizeCategoryName(category);
    let categoryFields: { category?: string; newCategory?: true };
    if (isStorableCategory(normalized)) {
      if (
        isEditing &&
        !categoryChangedOnEdit(
          { category: expense.category, type: expense.type || "debit" },
          { category: normalized, type: txnType },
        )
      ) {
        // An edit is resolved or flagged only when its category or type
        // changed. Otherwise an amount-only edit of an old "Fodo" would bring
        // back a chip the user removed, and an old "food" would be rewritten
        // to "Food". The text is saved as before.
        categoryFields = { category: category.trim() || undefined };
      } else {
        // The saved spelling when the list has it ("food" → "Food"). Flagged
        // only when it doesn't, so the server adds it to the list.
        categoryFields = {
          category: resolveSpelling(list, txnType, normalized),
        };
        if (isNewCategory(list, txnType, normalized)) {
          categoryFields.newCategory = true;
        }
      }
    } else {
      // Blank or the old "-" placeholder: saved as before, never flagged.
      categoryFields = { category: normalized || undefined };
    }

    const expenseData = {
      amount: parsed.value,
      // UTC midnight of the picked calendar date — see utils/dates.ts.
      date: toApiDate(date),
      remarks: remarks.trim() || undefined,
      ...categoryFields,
      type: txnType,
    };

    const submit = async () => {
      setSaving(true);
      try {
        if (isEditing) {
          const response = await editExpenseApi(expense._id, expenseData);
          dispatch(updateExpense({ expense: response.data.expense }));
          // Any category the server stored goes into the saved list (+1 rule).
          void applyCategoryReply(response.data as ExpenseCategoryReply);
        } else {
          const response = await addExpenseApi(expenseData);
          dispatch(addExpense(response.data.expense));
          void applyCategoryReply(response.data as ExpenseCategoryReply);
        }

        /**
         * Invalidate the cache for BOTH the previous and the new ledger.
         *
         * Nothing invalidated it before, so within the 60-second TTL a
         * deleted or edited expense reappeared from AsyncStorage on the next
         * visit and then vanished again when the network response landed.
         *
         * Both keys matter because the server may move the expense to a
         * different month's ledger when its date changes.
         */
        await Promise.all([
          cacheManager.remove(CACHE_KEYS.EXPENSES(ledgerId || "")),
          cacheManager.remove(CACHE_KEYS.EXPENSE_LEDGERS),
          cacheManager.remove(CACHE_KEYS.EXPENSE_STATS),
        ]);

        showSuccessToast(
          isEditing
            ? "Expense updated!"
            : txnType === "credit"
              ? "Credit added!"
              : "Expense added!",
          parsed.value,
        );
        navigation.goBack();
      } catch (error) {
        // Stay on the form. The user keeps what they typed and can retry.
        Alert.alert(
          isEditing ? "Could not update" : "Could not save",
          describeError(error),
        );
      } finally {
        setSaving(false);
      }
    };

    if (isEditing) {
      await submit();
      return;
    }

    // Add: check for a likely duplicate first.
    setSaving(true);
    try {
      const res = await checkDuplicateExpenseApi(parsed.value, toApiDate(date));
      setSaving(false);

      if (res.data?.success && res.data.duplicates?.length > 0) {
        const dup = res.data.duplicates[0];
        Alert.alert(
          "Possible duplicate",
          `A similar entry already exists on ${formatDate(dup.date)}:\n` +
            `${formatCurrency(dup.amount)}${dup.remarks ? ` — ${dup.remarks}` : ""}\n\n` +
            `Add this one anyway?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Add anyway", onPress: () => void submit() },
          ],
        );
      } else {
        await submit();
      }
    } catch {
      // The duplicate check is advisory. If it fails — offline, or the server
      // is unhappy — saving the expense is still the user's intent.
      setSaving(false);
      await submit();
    }
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
        <Text style={[styles.title, { color: colors.text }]}>
          {isEditing
            ? txnType === "credit"
              ? "Edit Credit"
              : "Edit Expense"
            : txnType === "credit"
              ? "Add Credit"
              : "Add Expense"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* "handled": with the keyboard up, a tap on a category chip must pick
          it, not just close the keyboard. */}
      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        {/* Amount */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Amount *
          </Text>
          <TextInput
            style={[
              styles.amountInput,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.inputPlaceholder}
          />
        </View>

        {/* Type Toggle */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Type
          </Text>
          <View
            style={[styles.typeToggle, { backgroundColor: colors.surface }]}
          >
            <TouchableOpacity
              style={[
                styles.typeButton,
                txnType === "debit" && {
                  backgroundColor: colors.chart.accentDebit,
                },
              ]}
              onPress={() => setTxnType("debit")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-up-circle"
                size={20}
                color={txnType === "debit" ? ON_ACCENT : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  {
                    color:
                      txnType === "debit" ? ON_ACCENT : colors.textSecondary,
                  },
                ]}
              >
                Debit (Money Out)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                txnType === "credit" && {
                  backgroundColor: colors.chart.accentCredit,
                },
              ]}
              onPress={() => setTxnType("credit")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-down-circle"
                size={20}
                color={txnType === "credit" ? ON_ACCENT : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  {
                    color:
                      txnType === "credit" ? ON_ACCENT : colors.textSecondary,
                  },
                ]}
              >
                Credit (Money In)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Date *
          </Text>
          <TouchableOpacity
            style={[
              styles.dateButton,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.dateText, { color: colors.text }]}>
              {date.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              // Bounds that always include the value being edited, so the
              // Android picker cannot clamp and silently rewrite the date.
              minimumDate={pickerMinimumDate(isEditing ? expense.date : null)}
              maximumDate={pickerMaximumDate(isEditing ? expense.date : null)}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === "ios");
                // Only a deliberate selection: Android also emits "dismissed".
                if (event.type === "set" && selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>

        {/* Remarks */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Remarks
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Optional description"
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Category
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g., Food, Transport, Shopping"
            placeholderTextColor={colors.inputPlaceholder}
          />
          <CategoryChips
            chips={chips}
            selectedId={selectedId}
            onPick={setCategory}
            onRemove={handleRemoveCategory}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
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
  title: { fontSize: 18, fontWeight: "700" },
  form: { padding: 16 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlignVertical: "top",
  },
  amountInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateText: { fontSize: 16 },
  typeToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  typeButtonText: {
    fontWeight: "600",
    fontSize: 14,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonText: { color: ON_ACCENT, fontSize: 16, fontWeight: "700" },
});

export default AddEditExpenseScreen;
