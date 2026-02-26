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
import { registerApi, sendOtpApi, verifyOtpApi } from "../../api/authApi";
import { tokenManager } from "../../utils/tokenManager";
import { useAppDispatch } from "../../store";
import { setCredentials, setLoading } from "../../store/slices/authSlice";

type Step = "form" | "otp";

const RegisterScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();

  // Step 1 fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 - OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  const [step, setStep] = useState<Step>("form");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoadingState] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Cooldown timer ──────────────────────────────────────
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

  // ── Step 1 validation ───────────────────────────────────
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    else if (phone.trim().length < 10)
      newErrors.phone = "Enter a valid phone number";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email.trim()))
      newErrors.email = "Enter a valid email address";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (field: string) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // ── Step 1 → send OTP ───────────────────────────────────
  const handleSendOtp = async () => {
    if (!validateForm()) return;
    setLoadingState(true);
    try {
      await sendOtpApi(email.trim());
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

  // ── Resend OTP ──────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await sendOtpApi(email.trim());
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
    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Step 2 → verify OTP + register ─────────────────────
  const handleRegister = async () => {
    const otpValue = otp.join("");
    if (otpValue.length < 6) {
      Alert.alert("Invalid OTP", "Please enter all 6 digits");
      return;
    }

    setLoadingState(true);
    dispatch(setLoading(true));
    try {
      // Verify OTP first
      await verifyOtpApi(email.trim(), otpValue);

      // Then register
      const response = await registerApi(
        name.trim(),
        phone.trim(),
        email.trim(),
        password,
      );
      const { access_token, refresh_token, user } = response.data;
      await tokenManager.saveAuthData(access_token, refresh_token, user);
      dispatch(setCredentials(user));
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Registration failed. Please try again.";
      Alert.alert("Registration Failed", message);
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

  const inputWrapper = (hasError: boolean) => [
    styles.inputWrapper,
    {
      backgroundColor: colors.inputBackground,
      borderColor: hasError ? colors.danger : colors.inputBorder,
    },
  ];

  // ─────────────────────────────────────────────────────────
  // RENDER: Step 1 — Form
  // ─────────────────────────────────────────────────────────
  if (step === "form") {
    return (
      <SafeAreaWrapper>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
              <Text
                style={[styles.title, { color: colors.text, fontSize: fs.xxl }]}
              >
                Create account
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.textTertiary, fontSize: fs.md },
                ]}
              >
                Sign up to get started with Finzz
              </Text>

              <View style={styles.form}>
                {/* Full Name */}
                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textSecondary }]}
                  >
                    Full Name
                  </Text>
                  <View style={inputWrapper(!!errors.name)}>
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={colors.textTertiary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        clearError("name");
                      }}
                      placeholder="Enter your name"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="words"
                      style={[styles.textInput, { color: colors.text }]}
                    />
                  </View>
                  {errors.name && (
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      {errors.name}
                    </Text>
                  )}
                </View>

                {/* Phone */}
                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textSecondary }]}
                  >
                    Phone Number
                  </Text>
                  <View style={inputWrapper(!!errors.phone)}>
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color={colors.textTertiary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={phone}
                      onChangeText={(t) => {
                        setPhone(t);
                        clearError("phone");
                      }}
                      placeholder="+91 98765 43210"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="phone-pad"
                      style={[styles.textInput, { color: colors.text }]}
                    />
                  </View>
                  {errors.phone && (
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      {errors.phone}
                    </Text>
                  )}
                </View>

                {/* Email */}
                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textSecondary }]}
                  >
                    Email Address
                  </Text>
                  <View style={inputWrapper(!!errors.email)}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={colors.textTertiary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        clearError("email");
                      }}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={[styles.textInput, { color: colors.text }]}
                    />
                  </View>
                  {errors.email && (
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      {errors.email}
                    </Text>
                  )}
                </View>

                {/* Password */}
                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textSecondary }]}
                  >
                    Password
                  </Text>
                  <View style={inputWrapper(!!errors.password)}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={colors.textTertiary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        clearError("password");
                      }}
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
                  {errors.password && (
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      {errors.password}
                    </Text>
                  )}
                </View>

                {/* Confirm Password */}
                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textSecondary }]}
                  >
                    Confirm Password
                  </Text>
                  <View style={inputWrapper(!!errors.confirmPassword)}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={colors.textTertiary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={confirmPassword}
                      onChangeText={(t) => {
                        setConfirmPassword(t);
                        clearError("confirmPassword");
                      }}
                      placeholder="Confirm your password"
                      placeholderTextColor={colors.textTertiary}
                      secureTextEntry
                      style={[styles.textInput, { color: colors.text }]}
                    />
                  </View>
                  {errors.confirmPassword && (
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      {errors.confirmPassword}
                    </Text>
                  )}
                </View>

                <Button
                  title="Send Verification OTP"
                  onPress={handleSendOtp}
                  loading={loading}
                  fullWidth
                  size="lg"
                  style={{ marginTop: 8 }}
                />
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate("Login")}
                style={styles.switchAuth}
              >
                <Text
                  style={[styles.switchText, { color: colors.textTertiary }]}
                >
                  Already have an account?{" "}
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>
                    Login
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: Step 2 — OTP Verification
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setStep("form")}
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
                styles.otpIconWrapper,
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
              Verify Email
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

            {/* OTP boxes */}
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
                      borderColor: digit ? colors.primary : colors.inputBorder,
                      backgroundColor: colors.inputBackground,
                    },
                  ]}
                />
              ))}
            </View>

            <Button
              title="Verify & Create Account"
              onPress={handleRegister}
              loading={loading}
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
                      resendCooldown > 0 ? colors.textTertiary : colors.primary,
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
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 10 },
  backButton: { fontSize: 28, fontWeight: "300" },
  content: { flex: 1, paddingHorizontal: 32 },
  title: { fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { marginBottom: 32, lineHeight: 22 },
  form: { gap: 16 },
  switchAuth: { alignItems: "center", marginTop: 32, paddingVertical: 12 },
  switchText: { fontSize: 15 },
  inputContainer: { marginBottom: 4 },
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
  errorText: { marginTop: 4, marginLeft: 4, fontSize: 12 },
  otpIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
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

export default RegisterScreen;
