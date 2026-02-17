import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { SafeAreaWrapper, Input, Button } from "../../components/ui";
import { addTxApi, editTxApi } from "../../api/txApi";
import { useAppSelector, useAppDispatch } from "../../store";
import { addTx, updateTx } from "../../store/slices/chatSlice";
import { cacheManager, CACHE_KEYS } from "../../utils/cacheManager";
import { ITx } from "../../types";

const AddEditTxScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs, borderRadius: br } = theme;
  const { showSuccessToast } = useToast();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const { chatId, tx, friendName, friend } = route.params;
  const isEditing = !!tx;

  const [amount, setAmount] = useState(isEditing ? String(tx.amount) : "");
  const [direction, setDirection] = useState<"gave" | "received">(
    isEditing ? (tx.from === user?._id ? "gave" : "received") : "gave",
  );
  const [date, setDate] = useState(isEditing ? new Date(tx.date) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [remarks, setRemarks] = useState(isEditing ? tx.remarks || "" : "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(
        "Invalid Amount",
        "Please enter a valid amount greater than 0",
      );
      return;
    }

    if (isEditing && tx.verified) {
      Alert.alert("Cannot Edit", "Verified transactions cannot be edited");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const friendId = friend?._id || (tx?.to === user?._id ? tx?.from : tx?.to);
    const payload = {
      chatId,
      amount: numAmount,
      date: date.toISOString(),
      remarks: remarks.trim() || undefined,
      to: direction === "gave" ? friendId : user?._id || "",
      from: direction === "gave" ? user?._id || "" : friendId,
    };

    try {
      if (isEditing) {
        const response = await editTxApi(tx._id, payload);
        dispatch(updateTx(response.data.txn || response.data));
      } else {
        const response = await addTxApi(payload);
        dispatch(addTx(response.data.txn || response.data));
      }
      await cacheManager.remove(CACHE_KEYS.TRANSACTIONS(chatId));
      await cacheManager.remove(CACHE_KEYS.CHATS);
      showSuccessToast(
        isEditing ? "Transaction updated!" : "Transaction added!",
        numAmount,
      );
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header */}
          <View
            style={[styles.header, { borderBottomColor: colors.separator }]}
          >
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text
              style={[
                styles.headerTitle,
                { color: colors.text, fontSize: fs.lg },
              ]}
            >
              {isEditing ? "Edit Transaction" : "New Transaction"}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.form}>
            {/* Amount */}
            <View style={styles.amountSection}>
              <Text
                style={[styles.currencySymbol, { color: colors.textTertiary }]}
              >
                ₹
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                autoFocus
                style={[
                  styles.amountInput,
                  { color: colors.text, fontSize: 48 }, // Explicitly set text color and size
                ]}
              />
            </View>

            {/* Direction Toggle */}
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              Direction
            </Text>
            <View
              style={[
                styles.toggleContainer,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  setDirection("gave");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.toggleButton,
                  direction === "gave" && {
                    backgroundColor: colors.debit,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={direction === "gave" ? "#FFF" : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.toggleText,
                    {
                      color:
                        direction === "gave" ? "#FFF" : colors.textTertiary,
                      fontSize: fs.md,
                    },
                  ]}
                >
                  I Gave
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setDirection("received");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.toggleButton,
                  direction === "received" && {
                    backgroundColor: colors.credit,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-down"
                  size={18}
                  color={
                    direction === "received" ? "#FFF" : colors.textTertiary
                  }
                />
                <Text
                  style={[
                    styles.toggleText,
                    {
                      color:
                        direction === "received" ? "#FFF" : colors.textTertiary,
                      fontSize: fs.md,
                    },
                  ]}
                >
                  I Received
                </Text>
              </TouchableOpacity>
            </View>

            {/* Info text */}
            <Text
              style={[
                styles.infoText,
                { color: colors.textTertiary, fontSize: fs.sm },
              ]}
            >
              {direction === "gave"
                ? `You → ${friendName || "Friend"}`
                : `${friendName || "Friend"} → You`}
            </Text>

            {/* Date */}
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.textSecondary, fontSize: fs.sm, marginTop: 20 },
              ]}
            >
              Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(!showDatePicker)}
              style={[
                styles.dateButton,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.textTertiary}
              />
              <Text
                style={[
                  styles.dateText,
                  { color: colors.text, fontSize: fs.md },
                ]}
              >
                {dayjs(date).format("DD MMM YYYY")}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <View>
                {Platform.OS === "ios" && (
                  <View style={styles.datePickerHeader}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text
                        style={{ color: colors.primary, fontWeight: "600" }}
                      >
                        Done
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={
                    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                  }
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === "android") {
                      setShowDatePicker(false);
                    }
                    if (selectedDate) setDate(selectedDate);
                  }}
                  textColor={colors.text}
                />
              </View>
            )}

            {/* Remarks */}
            <View style={{ marginTop: 24 }}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.textSecondary, fontSize: fs.sm },
                ]}
              >
                Remarks (Optional)
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                  },
                ]}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={20}
                  color={colors.textTertiary}
                  style={{ marginRight: 12 }}
                />
                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="e.g., Lunch, Movie tickets..."
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.textInput,
                    { color: colors.text, fontSize: fs.md },
                  ]}
                />
              </View>
            </View>

            {/* Submit */}
            <Button
              title={isEditing ? "Update Transaction" : "Add Transaction"}
              onPress={handleSubmit}
              loading={loading}
              fullWidth
              size="lg"
              style={{ marginTop: 16 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    // borderBottomWidth: StyleSheet.hairlineWidth, // Cleaner header
  },
  headerTitle: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  amountSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    transform: [{ scale: 1.2 }], // Make it slightly larger
  },
  currencySymbol: {
    fontSize: 40,
    fontWeight: "700",
    marginRight: 8,
  },
  amountInput: {
    flex: 0,
    minWidth: 100,
    fontSize: 40,
    fontWeight: "700",
    textAlign: "center",
    borderBottomWidth: 0,
    backgroundColor: "transparent",
  },
  sectionLabel: {
    fontWeight: "700",
    marginBottom: 12,
    marginLeft: 4,
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 1,
    opacity: 0.7,
  },
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 6,
    gap: 8,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  toggleText: {
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  infoText: {
    marginTop: 12,
    marginLeft: 4,
    fontStyle: "italic",
    textAlign: "center",
    opacity: 0.6,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  dateText: {
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    padding: 0, // Reset padding for TextInput inside container
  },
  datePickerHeader: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
});

export default AddEditTxScreen;
