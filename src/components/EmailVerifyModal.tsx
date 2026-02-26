import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { Button } from "./ui";
import { sendVerifyEmailOtpApi, verifyEmailApi } from "../api/authApi";
import { useAppDispatch } from "../store";
import { updateUser } from "../store/slices/authSlice";
import { tokenManager } from "../utils/tokenManager";

interface EmailVerifyModalProps {
  visible: boolean;
  onDismiss: () => void;
}

type Step = "email" | "otp";

const EmailVerifyModal: React.FC<EmailVerifyModalProps> = ({
  visible,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoadingState] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetState = () => {
    setStep("email");
    setEmail("");
    setOtp(["", "", "", "", "", ""]);
    setResendCooldown(0);
  };

  const handleDismiss = () => {
    resetState();
    onDismiss();
  };

  // ── Step 1: Send OTP ────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address");
      return;
    }
    setLoadingState(true);
    try {
      await sendVerifyEmailOtpApi(email.trim());
      setStep("otp");
      startCooldown();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to send OTP",
      );
    } finally {
      setLoadingState(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await sendVerifyEmailOtpApi(email.trim());
      startCooldown();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to resend OTP",
      );
    }
  };

  // ── OTP input handlers ──────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────
  const handleVerify = async () => {
    const otpValue = otp.join("");
    if (otpValue.length < 6) {
      Alert.alert("Invalid OTP", "Please enter all 6 digits");
      return;
    }
    setLoadingState(true);
    try {
      const res = await verifyEmailApi(email.trim(), otpValue);
      // Update redux store and cached user data
      dispatch(updateUser({ email: email.trim(), emailVerified: true }));
      const userData = await tokenManager.getUserData();
      if (userData) {
        const parsed = JSON.parse(userData);
        await tokenManager.setUserData(
          JSON.stringify({
            ...parsed,
            email: email.trim(),
            emailVerified: true,
          }),
        );
      }
      Alert.alert(
        "Email Verified! ✓",
        "Your email has been verified successfully.",
        [{ text: "OK", onPress: handleDismiss }],
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Verification failed",
      );
    } finally {
      setLoadingState(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <View />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Verify Email
          </Text>
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Icon */}
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: colors.primarySurface },
            ]}
          >
            <Ionicons name="mail-outline" size={32} color={colors.primary} />
          </View>

          {step === "email" ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                Add Your Email
              </Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                Email is required for secure features like password recovery.
                Your email won't be visible to others.
              </Text>

              <View style={styles.inputContainer}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                >
                  Email Address
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
                    name="mail-outline"
                    size={18}
                    color={colors.textTertiary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </View>
              </View>

              <Button
                title="Send OTP"
                onPress={handleSendOtp}
                loading={loading}
                fullWidth
                size="lg"
              />

              <TouchableOpacity
                onPress={handleDismiss}
                style={styles.skipButton}
              >
                <Text style={[styles.skipText, { color: colors.textTertiary }]}>
                  Maybe Later
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                Enter OTP
              </Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                We sent a 6-digit OTP to{" "}
                <Text style={{ color: colors.primary, fontWeight: "600" }}>
                  {email}
                </Text>
              </Text>

              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      otpRefs.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={(text) =>
                      handleOtpChange(text.slice(-1), index)
                    }
                    onKeyPress={({ nativeEvent }) =>
                      handleOtpKeyPress(nativeEvent.key, index)
                    }
                    keyboardType="number-pad"
                    maxLength={1}
                    style={[
                      styles.otpInput,
                      {
                        color: colors.text,
                        borderColor: digit
                          ? colors.primary
                          : colors.inputBorder,
                        backgroundColor: colors.inputBackground,
                      },
                    ]}
                  />
                ))}
              </View>

              <Button
                title="Verify Email"
                onPress={handleVerify}
                loading={loading}
                fullWidth
                size="lg"
                style={{ marginTop: 24 }}
              />

              <View style={styles.resendRow}>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resendCooldown > 0}
                >
                  <Text
                    style={[
                      styles.resendText,
                      {
                        color:
                          resendCooldown > 0
                            ? colors.textTertiary
                            : colors.primary,
                      },
                    ]}
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend OTP"}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={[{ color: colors.textTertiary }, styles.resendSep]}
                >
                  {" "}
                  ·{" "}
                </Text>
                <TouchableOpacity onPress={() => setStep("email")}>
                  <Text style={[styles.resendText, { color: colors.primary }]}>
                    Change Email
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 32 },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 28,
  },
  inputContainer: { marginBottom: 20 },
  inputLabel: { marginBottom: 6, fontWeight: "500", marginLeft: 4 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 16 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  otpInput: {
    flex: 1,
    height: 52,
    borderWidth: 2,
    borderRadius: 14,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
  },
  skipButton: { alignItems: "center", marginTop: 20, paddingVertical: 12 },
  skipText: { fontSize: 14 },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  resendText: { fontSize: 14, fontWeight: "600" },
  resendSep: { fontSize: 14 },
});

export default EmailVerifyModal;
