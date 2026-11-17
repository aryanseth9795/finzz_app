import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Button } from "../../components/ui";
import { deleteAccountApi } from "../../api/authApi";
import { useAppDispatch } from "../../store";
import { signOutOnThisDevice } from "../../services/signOut";
import {
  canSubmitDeletion,
  deletionErrorMessage,
  DELETE_CONFIRM_WORD,
} from "../../utils/deleteAccount";

const DELETED = [
  "Your profile, login and profile photo",
  "Your personal expenses, categories and reports",
  "Your 1:1 chats and their transactions, for you and the friend",
  "Notes you own",
  "Pool entries you added",
  "Your friend list and friend requests",
  "Your notifications",
  "This account's push notification registrations",
  "Your daily usage records",
];

const STAYS = [
  "The Password Vault on this phone (it never left your device)",
  "Notes friends shared with you stay with their owners",
  "Pools keep their other members, the pool itself (its name, description and rules) and entries other members added",
];

const DeleteAccountScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
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
    };
  }, []);

  const handleDelete = async () => {
    if (inFlight.current || !canSubmitDeletion(password, typed)) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      await deleteAccountApi(password);
    } catch (err: any) {
      setError(
        deletionErrorMessage(
          err?.response?.status,
          err?.response?.data?.message,
        ),
      );
      // Keep the confirm word, but never leave the password sitting in state.
      setPassword("");
      setLoading(false);
      inFlight.current = false;
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Account deleted",
      "Your Finzz account and its data have been deleted.",
    );
    await signOutOnThisDevice(dispatch, { notifyServer: false });
  };

  const list = (items: string[], icon: "close-circle" | "checkmark-circle", color: string) =>
    items.map((item) => (
      <View key={item} style={styles.listRow}>
        <Ionicons name={icon} size={16} color={color} style={styles.listIcon} />
        <Text
          style={[styles.listText, { color: colors.textSecondary, fontSize: fs.sm }]}
        >
          {item}
        </Text>
      </View>
    ));

  return (
    <SafeAreaWrapper edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs.lg }]}>
          Delete account
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 40 + keyboardHeight },
        ]}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.danger },
          ]}
        >
          <View style={styles.cardTitleRow}>
            <Ionicons name="warning-outline" size={22} color={colors.danger} />
            <Text style={[styles.cardTitle, { color: colors.danger, fontSize: fs.lg }]}>
              This can't be undone
            </Text>
          </View>

          <Text style={[styles.groupLabel, { color: colors.text, fontSize: fs.md }]}>
            Deleted
          </Text>
          {list(DELETED, "close-circle", colors.danger)}

          <Text
            style={[
              styles.groupLabel,
              { color: colors.text, fontSize: fs.md, marginTop: 14 },
            ]}
          >
            Stays
          </Text>
          {list(STAYS, "checkmark-circle", colors.success || "#22c55e")}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Password
        </Text>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={colors.textTertiary}
            style={{ marginRight: 10 }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel="Password"
            style={[styles.input, { color: colors.text }]}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide Password" : "Show Password"}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Type {DELETE_CONFIRM_WORD} to confirm
        </Text>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder={DELETE_CONFIRM_WORD}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={`Type ${DELETE_CONFIRM_WORD} to confirm`}
            style={[styles.input, { color: colors.text }]}
          />
        </View>

        {!!error && (
          <Text style={[styles.error, { color: colors.danger, fontSize: fs.sm }]}>
            {error}
          </Text>
        )}

        <Button
          title="Delete my account"
          onPress={handleDelete}
          variant="danger"
          loading={loading}
          disabled={!canSubmitDeletion(password, typed)}
          fullWidth
          size="lg"
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontWeight: "700" },
  content: { padding: 20 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 12 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: "800" },
  groupLabel: { fontWeight: "700", marginBottom: 6 },
  listRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  listIcon: { marginTop: 2, marginRight: 8 },
  listText: { flex: 1, lineHeight: 20 },
  label: { marginBottom: 6, marginTop: 14, fontWeight: "500", marginLeft: 4 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 15 },
  error: { marginTop: 14, fontWeight: "500" },
});

export default DeleteAccountScreen;
