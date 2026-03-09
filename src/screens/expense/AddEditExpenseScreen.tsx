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
  const [date, setDate] = useState(
    expense ? new Date(expense.date) : new Date(),
  );
  const [remarks, setRemarks] = useState(expense?.remarks || "");
  const [category, setCategory] = useState(expense?.category || "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) >= 10000000) {
      Alert.alert("Amount Too Large", "Amount must be less than ₹1 Crore");
      return;
    }

    const expenseData = {
      amount: parseFloat(amount),
      date: date.toISOString(),
      remarks: remarks.trim() || undefined,
      category: category.trim() || undefined,
      type: txnType,
    };

    const proceedWithAdd = async () => {
      setSaving(true);
      try {
        const tempId = `temp_${Date.now()}`;
        const tempExpense: IExpense = {
          _id: tempId,
          userId: "",
          ledgerId: ledgerId || "",
          ...expenseData,
          type: txnType,
          date: date.toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Optimistic update
        dispatch(addExpense(tempExpense));

        // Navigate back immediately
        showSuccessToast(
          txnType === "credit" ? "Credit added!" : "Expense added!",
          parseFloat(amount),
        );
        navigation.goBack();

        // Call server in background
        try {
          const response = await addExpenseApi(expenseData);
          dispatch(
            updateExpense({ oldId: tempId, expense: response.data.expense }),
          );
          // Trigger parent screen refresh to update ledger totals
          if (navigation.getParent()?.setParams) {
            navigation.getParent().setParams({ refreshTimestamp: Date.now() });
          }
        } catch (error: any) {
          console.error("Failed to add expense:", error);
          Alert.alert(
            "Error",
            error.response?.data?.message || "Failed to add expense",
          );
        }
      } catch (error) {
        setSaving(false);
        Alert.alert("Error", "Failed to add expense");
      }
    };

    if (isEditing) {
      setSaving(true);
      try {
        // Update existing expense
        const oldExpense = expense;
        const updatedExpense: IExpense = { ...oldExpense, ...expenseData };

        // Optimistic update
        dispatch(updateExpense({ expense: updatedExpense }));

        // Navigate back immediately
        navigation.goBack();

        //  Call server in background
        try {
          const response = await editExpenseApi(expense._id, expenseData);
          dispatch(updateExpense({ expense: response.data.expense }));
          // Trigger parent screen refresh
          if (navigation.getParent()?.setParams) {
            navigation.getParent().setParams({ refreshTimestamp: Date.now() });
          }
        } catch (error: any) {
          console.error("Failed to update expense:", error);
          // Rollback
          dispatch(updateExpense({ expense: oldExpense }));
          Alert.alert(
            "Error",
            error.response?.data?.message || "Failed to update expense",
          );
        }
      } catch (error) {
        setSaving(false);
        Alert.alert("Error", "An unexpected error occurred");
      }
    } else {
      // Add New: Check for duplicates first
      setSaving(true);
      try {
        const res = await checkDuplicateExpenseApi(
          parseFloat(amount),
          date.toISOString(),
        );

        if (res.data.success && res.data.duplicates.length > 0) {
          setSaving(false);
          const dup = res.data.duplicates[0];
          const dateStr = new Date(dup.date).toLocaleDateString();
          Alert.alert(
            "Duplicate Warning",
            `Found similar expense on ${dateStr}:\nAmount: ₹${dup.amount}\nRemarks: ${dup.remarks || "None"}\n\nAdd anyway?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Add", onPress: proceedWithAdd },
            ],
          );
        } else {
          proceedWithAdd();
        }
      } catch (error) {
        // If check fails (e.g. offline), warn or proceed? Proceeding is safer UX.
        proceedWithAdd();
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === "ios");
                if (selectedDate) setDate(selectedDate);
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
    </View>
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
