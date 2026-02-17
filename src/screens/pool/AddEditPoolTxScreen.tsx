import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { SafeAreaWrapper } from "../../components/ui";
import { addPoolTxApi } from "../../api/poolApi";

const AddEditPoolTxScreen = ({ route, navigation }: any) => {
  const { poolId, mode = "add" } = route.params; // mode: "add" | "edit"
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const { showSuccessToast } = useToast();

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      setLoading(true);
      await addPoolTxApi({
        poolId,
        amount: parseFloat(amount),
        type,
        date: date.toISOString(),
        remarks: remarks.trim() || undefined,
      });

      showSuccessToast("Transaction added!", parseFloat(amount));
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to add transaction",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.text, fontSize: fs.xl },
            ]}
          >
            {mode === "add" ? "Add Transaction" : "Edit Transaction"}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Form */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type Toggle */}
          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              Type
            </Text>
            <View
              style={[styles.typeToggle, { backgroundColor: colors.surface }]}
            >
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === "credit" && {
                    backgroundColor: colors.primary,
                  },
                ]}
                onPress={() => setType("credit")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="arrow-down-circle"
                  size={20}
                  color={type === "credit" ? "#fff" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    {
                      color: type === "credit" ? "#fff" : colors.textSecondary,
                      fontSize: fs.sm,
                    },
                  ]}
                >
                  Credit (Money In)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === "debit" && {
                    backgroundColor: colors.danger,
                  },
                ]}
                onPress={() => setType("debit")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={20}
                  color={type === "debit" ? "#fff" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    {
                      color: type === "debit" ? "#fff" : colors.textSecondary,
                      fontSize: fs.sm,
                    },
                  ]}
                >
                  Debit (Money Out)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              Amount <Text style={{ color: colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: fs.md,
                  borderColor: colors.border,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Date */}
          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              Date
            </Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  styles.dateText,
                  { color: colors.text, fontSize: fs.md },
                ]}
              >
                {date.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          {/* Remarks */}
          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              Remarks (Optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: fs.md,
                  borderColor: colors.border,
                },
              ]}
              placeholder="E.g. Dinner at Goa"
              placeholderTextColor={colors.textTertiary}
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity: !amount || loading ? 0.5 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={!amount || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.submitButtonText, { fontSize: fs.md }]}>
                {mode === "add" ? "Add Transaction" : "Update Transaction"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontWeight: "600",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontWeight: "600",
    marginBottom: 8,
  },
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
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontWeight: "400",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateText: {
    fontWeight: "500",
  },
  textArea: {
    minHeight: 80,
  },
  submitButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default AddEditPoolTxScreen;
