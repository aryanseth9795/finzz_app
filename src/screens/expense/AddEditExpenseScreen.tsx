import React, { useState } from "react";
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
import { IExpense } from "../../types";

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

    const expenseData = {
      amount: parsed.value,
      // UTC midnight of the picked calendar date — see utils/dates.ts.
      date: toApiDate(date),
      remarks: remarks.trim() || undefined,
      category: category.trim() || undefined,
      type: txnType,
    };

    const submit = async () => {
      setSaving(true);
      try {
        if (isEditing) {
          const response = await editExpenseApi(expense._id, expenseData);
          dispatch(updateExpense({ expense: response.data.expense }));
        } else {
          const response = await addExpenseApi(expenseData);
          dispatch(addExpense(response.data.expense));
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

      <ScrollView style={styles.form}>
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
                  backgroundColor: colors.danger || "#EF4444",
                },
              ]}
              onPress={() => setTxnType("debit")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-up-circle"
                size={20}
                color={txnType === "debit" ? "#fff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  {
                    color: txnType === "debit" ? "#fff" : colors.textSecondary,
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
                  backgroundColor: "#22C55E",
                },
              ]}
              onPress={() => setTxnType("credit")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-down-circle"
                size={20}
                color={txnType === "credit" ? "#fff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  {
                    color: txnType === "credit" ? "#fff" : colors.textSecondary,
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
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

export default AddEditExpenseScreen;
