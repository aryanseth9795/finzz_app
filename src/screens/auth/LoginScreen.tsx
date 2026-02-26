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
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Input, Button } from "../../components/ui";
import { loginApi } from "../../api/authApi";
import { tokenManager } from "../../utils/tokenManager";
import { useAppDispatch } from "../../store";
import { setCredentials, setLoading } from "../../store/slices/authSlice";

const LoginScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>(
    {},
  );
  const [loading, setLoadingState] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    else if (phone.trim().length < 10)
      newErrors.phone = "Enter a valid phone number";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoadingState(true);
    dispatch(setLoading(true));

    try {
      const response = await loginApi(phone.trim(), password);
      const { access_token, refresh_token, user } = response.data;

      await tokenManager.saveAuthData(access_token, refresh_token, user);
      dispatch(setCredentials(user));
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Login failed. Please try again.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

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
          {/* Header */}
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
              Welcome back
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.textTertiary, fontSize: fs.md },
              ]}
            >
              Login with your phone number
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                >
                  Phone Number
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: errors.phone
                        ? colors.danger
                        : colors.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color={colors.textTertiary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      if (errors.phone)
                        setErrors((e) => ({ ...e, phone: undefined }));
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

              <View style={styles.inputContainer}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                >
                  Password
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: errors.password
                        ? colors.danger
                        : colors.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.textTertiary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password)
                        setErrors((e) => ({ ...e, password: undefined }));
                    }}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showPassword}
                    style={[styles.textInput, { color: colors.text }]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

              <Button
                title="Login"
                onPress={handleLogin}
                loading={loading}
                fullWidth
                size="lg"
                style={{ marginTop: 8 }}
              />

              <TouchableOpacity
                onPress={() => navigation.navigate("ForgotPassword")}
                style={{ alignItems: "center", marginTop: 16 }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: fs.sm,
                    fontWeight: "600",
                  }}
                >
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("Register")}
              style={styles.switchAuth}
            >
              <Text style={[styles.switchText, { color: colors.textTertiary }]}>
                Don't have an account?{" "}
                <Text style={{ color: colors.primary, fontWeight: "600" }}>
                  Sign Up
                </Text>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center", // Center content vertically
    paddingBottom: 24,
  },
  header: {
    position: "absolute",
    top: 10,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    fontSize: 28,
    fontWeight: "300",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  title: {
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 40,
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  switchAuth: {
    alignItems: "center",
    marginTop: 32,
    paddingVertical: 12,
  },
  switchText: {
    fontSize: 15,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    marginBottom: 6,
    fontWeight: "500",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
  },
  errorText: {
    marginTop: 4,
    marginLeft: 4,
    fontSize: 12,
  },
});

export default LoginScreen;
