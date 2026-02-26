import React, { useState, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Button } from "../../components/ui";
import { forgotPasswordApi, resetPasswordApi } from "../../api/authApi";

type Step = "email" | "otp" | "password";

const ForgotPasswordScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  // ── Step 1: Send OTP ────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address");
      return;
    }
    setLoadingState(true);
    try {
      await forgotPasswordApi(email.trim());
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
      await forgotPasswordApi(email.trim());
      startCooldown();
      Alert.alert("OTP Sent", "A new OTP has been sent to your email.");
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
  const handleVerifyOtp = () => {
    const otpValue = otp.join("");
    if (otpValue.length < 6) {
      Alert.alert("Invalid OTP", "Please enter all 6 digits");
      return;
    }
    setStep("password");
  };

  // ── Step 3: Reset Password ──────────────────────────────
  const handleResetPassword = async () => {
    const otpValue = otp.join("");
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match");
      return;
    }
    setLoadingState(true);
    try {
      await resetPasswordApi(email.trim(), otpValue, newPassword);
      Alert.alert("Success", "Password reset successfully!", [
        { text: "Login", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to reset password",
      );
    } finally {
      setLoadingState(false);
    }
  };

  const inputWrapper = (borderColor?: string) => [
    styles.inputWrapper,
    {
      backgroundColor: colors.inputBackground,
      borderColor: borderColor || colors.inputBorder,
    },
  ];

  // ─────────────────────────────────────────────────────────
  // RENDER: Step 1 — Email
  // ─────────────────────────────────────────────────────────
  if (step === "email") {
    return (
      <SafeAreaWrapper>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { justifyContent: "center" },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.backButton, { color: colors.primary }]}>
                  ←
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.content}>
              <View
                style={[
                  styles.iconWrapper,
                  { backgroundColor: colors.primarySurface },
                ]}
              >
                <Ionicons
                  name="lock-open-outline"
                  size={36}
                  color={colors.primary}
                />
              </View>
              <Text
                style={[styles.title, { color: colors.text, fontSize: fs.xxl }]}
              >
                Forgot Password
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.textTertiary, fontSize: fs.md },
                ]}
              >
                Enter your registered email address and we'll send you an OTP to
                reset your password.
              </Text>
              <View style={styles.inputContainer}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                >
                  Email Address
                </Text>
                <View style={inputWrapper()}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
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
                style={{ marginTop: 8 }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: Step 2 — OTP
  // ─────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <SafeAreaWrapper>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { justifyContent: "center" },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setStep("email")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.backButton, { color: colors.primary }]}>
                  ←
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.content}>
              <View
                style={[
                  styles.iconWrapper,
                  { backgroundColor: colors.primarySurface },
                ]}
              >
                <Ionicons
                  name="mail-open-outline"
                  size={36}
                  color={colors.primary}
                />
              </View>
              <Text
                style={[styles.title, { color: colors.text, fontSize: fs.xxl }]}
              >
                Enter OTP
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.textTertiary, fontSize: fs.md },
                ]}
              >
                We sent a 6-digit OTP to{"\n"}
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
                title="Continue"
                onPress={handleVerifyOtp}
                fullWidth
                size="lg"
                style={{ marginTop: 24 }}
              />
              <TouchableOpacity
                onPress={handleResend}
                style={styles.resendButton}
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
                    ? `Resend OTP in ${resendCooldown}s`
                    : "Resend OTP"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: Step 3 — New Password
  // ─────────────────────────────────────────────────────────
  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { justifyContent: "center" },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setStep("otp")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.backButton, { color: colors.primary }]}>
                ←
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: colors.primarySurface },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={36}
                color={colors.primary}
              />
            </View>
            <Text
              style={[styles.title, { color: colors.text, fontSize: fs.xxl }]}
            >
              New Password
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.textTertiary, fontSize: fs.md },
              ]}
            >
              Set a new secure password for your account.
            </Text>
            <View style={styles.inputContainer}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                New Password
              </Text>
              <View style={inputWrapper()}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min 6 characters"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showPassword}
                  style={[styles.textInput, { color: colors.text }]}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Confirm Password
              </Text>
              <View style={inputWrapper()}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  style={[styles.textInput, { color: colors.text }]}
                />
              </View>
            </View>
            <Button
              title="Reset Password"
              onPress={handleResetPassword}
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
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 10 },
  backButton: { fontSize: 28, fontWeight: "300" },
  content: { flex: 1, paddingHorizontal: 32 },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
  title: { fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { marginBottom: 32, lineHeight: 22 },
  inputContainer: { marginBottom: 16 },
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
  textInput: { flex: 1, height: "100%", fontSize: 16 },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderRadius: 14,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
  },
  resendButton: { alignItems: "center", marginTop: 20, paddingVertical: 10 },
  resendText: { fontSize: 14, fontWeight: "600" },
});

export default ForgotPasswordScreen;
