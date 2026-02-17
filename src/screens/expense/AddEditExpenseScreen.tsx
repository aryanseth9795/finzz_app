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
import { useAppDispatch } from "../../store";
import { addExpense, updateExpense } from "../../store/slices/expenseSlice";
import { addExpenseApi, editExpenseApi } from "../../api/expenseApi";
import { IExpense } from "../../types";

const AddEditExpenseScreen = ({ route, navigation }: any) => {
  const { expense, ledgerId } = route.params || {};
  const isEditing = !!expense;

  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const dispatch = useAppDispatch();

  const [amount, setAmount] = useState(expense?.amount?.toString() || "");
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

    setSaving(true);

    try {
      const expenseData = {
        amount: parseFloat(amount),
        date: date.toISOString(),
        remarks: remarks.trim() || undefined,
        category: category.trim() || undefined,
      };

      if (isEditing) {
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
        } catch (error: any) {
          console.error("Failed to update expense:", error);
          // Rollback
          dispatch(updateExpense({ expense: oldExpense }));
          Alert.alert(
            "Error",
            error.response?.data?.message || "Failed to update expense",
          );
        }
      } else {
        // Add new expense
        const tempId = `temp_${Date.now()}`;
        const tempExpense: IExpense = {
          _id: tempId,
          userId: "",
          ledgerId: ledgerId || "",
          ...expenseData,
          date: date.toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Optimistic update
        dispatch(addExpense(tempExpense));

        // Navigate back immediately
        navigation.goBack();

        // Call server in background
        try {
          const response = await addExpenseApi(expenseData);
          dispatch(
            updateExpense({ oldId: tempId, expense: response.data.expense }),
          );
        } catch (error: any) {
          console.error("Failed to add expense:", error);
          Alert.alert(
            "Error",
            error.response?.data?.message || "Failed to add expense",
          );
        }
      }
    } catch (error: any) {
      setSaving(false);
      Alert.alert("Error", "An unexpected error occurred");
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
          {isEditing ? "Edit Expense" : "Add Expense"}
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
  saveButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

export default AddEditExpenseScreen;
