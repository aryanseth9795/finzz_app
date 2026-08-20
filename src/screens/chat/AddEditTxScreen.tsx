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
import { describeError } from "../../api/axios";
import { isRefTo, refId } from "../../utils/entities";
import { parseAmount } from "../../utils/money";
import {
  toApiDate,
  fromApiDate,
  pickerMinimumDate,
  pickerMaximumDate,
} from "../../utils/dates";
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

  /**
   * Direction of the money.
   *
   * Was `tx.from === user?._id ? "gave" : "received"`. `getTxns` POPULATES
   * `from`/`to` into objects while `types/index.ts` declared them as strings,
   * so that comparison was always false against a populated transaction — and
   * the toggle initialised to "I Received" regardless of the truth.
   *
   * A user resubmitting a rejected "I gave ₹5,000" got a form pre-set to the
   * opposite direction. Fixing only the remark and saving reversed the flow of
   * money — a ₹10,000 swing — and sent it for the counterparty's approval
   * looking entirely legitimate.
   *
   * `isRefTo` narrows both shapes, so it cannot silently disagree again.
   */
  const [direction, setDirection] = useState<"gave" | "received">(
    isEditing && isRefTo(tx.from, user?._id) ? "gave" : isEditing ? "received" : "gave",
  );

  const [date, setDate] = useState(
    isEditing ? fromApiDate(tx.date) : new Date(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [remarks, setRemarks] = useState(isEditing ? tx.remarks || "" : "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Centralised parsing: rejects NaN explicitly rather than relying on
    // comparisons, every one of which is false against NaN.
    const parsed = parseAmount(amount);
    if (!parsed.ok) {
      Alert.alert("Invalid Amount", parsed.message);
      return;
    }
    const numAmount = parsed.value;

    if (isEditing && tx.status !== "rejected") {
      // One guard, not two: the previous pair checked `status === "verified"`
      // and then `status !== "rejected"`, the second subsuming the first.
      Alert.alert(
        "Cannot Edit",
        tx.status === "verified"
          ? "Verified transactions cannot be edited."
          : "You can only edit a transaction after the other person has rejected it.",
      );
      return;
    }

    /**
     * The counterparty's id.
     *
     * `friend?._id || (tx?.to === user?._id ? tx?.from : tx?.to)` could yield a
     * populated OBJECT, which was then sent as `to`/`from` — writing garbage
     * participants into the ledger and the monthly summary.
     */
    const friendId =
      refId(friend) ??
      (isRefTo(tx?.to, user?._id) ? refId(tx?.from) : refId(tx?.to));

    if (!friendId || !user?._id) {
      Alert.alert(
        "Cannot Save",
        "Could not identify the other person in this chat. Please reopen the chat and try again.",
      );
      return;
    }

    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );

    const payload = {
      chatId,
      amount: numAmount,
      // UTC midnight of the calendar date the user actually picked. Local
      // midnight through `.toISOString()` shifted an IST user's 1st of the
      // month into the previous month on the server.
      date: toApiDate(date),
      remarks: remarks.trim() || undefined,
      to: direction === "gave" ? friendId : user._id,
      from: direction === "gave" ? user._id : friendId,
    };

    try {
      if (isEditing) {
        const response = await editTxApi(tx._id, payload);
        dispatch(updateTx(response.data.txn || response.data));
      } else {
        const response = await addTxApi(payload);
        dispatch(addTx(response.data.txn || response.data));
      }
      await cacheManager.removeByPrefix(CACHE_KEYS.TRANSACTIONS_PREFIX(chatId));
      await cacheManager.remove(CACHE_KEYS.CHATS);
      showSuccessToast(
        isEditing ? "Transaction updated!" : "Transaction added!",
        numAmount,
      );
      navigation.goBack();
    } catch (error) {
      // Stay on the form so the user's input is not lost.
      Alert.alert("Could not save", describeError(error));
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
              {isEditing ? "Resubmit Transaction" : "New Transaction"}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Resubmit banner (edit mode only) */}
          {isEditing && (
            <View
              style={[
                styles.resubmitBanner,
                { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" },
              ]}
            >
              <Ionicons name="refresh-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.resubmitText, { color: colors.primary }]}>
                Saving will resubmit this transaction for review
              </Text>
            </View>
          )}

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
                  /**
                   * Bounds must include the value being edited.
                   *
                   * These were hardcoded to the 1st of the CURRENT month and
                   * today. Editing a rejected transaction from a previous
                   * month put `value` outside the range, so the Android picker
                   * clamped to the minimum and fired `onChange` without the
                   * user touching anything — silently moving the transaction
                   * to the 1st of this month.
                   */
                  minimumDate={pickerMinimumDate(isEditing ? tx.date : null)}
                  maximumDate={pickerMaximumDate(isEditing ? tx.date : null)}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === "android") {
                      setShowDatePicker(false);
                    }
                    // Only accept a deliberate selection. Android emits a
                    // "dismissed" event too, which previously still applied
                    // whatever date the picker happened to hold.
                    if (event.type === "set" && selectedDate) {
                      setDate(selectedDate);
                    }
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
                  // Matches the server's 200-character limit. Without it the
                  // payload was unbounded and a long remark failed validation
                  // only after the user had finished typing it.
                  maxLength={200}
                  accessibilityLabel="Remarks, optional"
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
  resubmitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  resubmitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
});

export default AddEditTxScreen;
