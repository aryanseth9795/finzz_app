import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  KeyboardTypeOptions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  editable?: boolean;
  multiline?: boolean;
  maxLength?: number;
  style?: ViewStyle;
}

const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "none",
  error,
  leftIcon,
  editable = true,
  multiline = false,
  maxLength,
  style,
}) => {
  const { theme } = useTheme();
  const { colors, borderRadius: br, fontSize: fs, spacing: sp } = theme;
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isSecure = secureTextEntry && !showPassword;
  const borderColor = error
    ? colors.danger
    : isFocused
      ? colors.primary
      : colors.inputBorder;

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: colors.textSecondary, fontSize: fs.sm },
          ]}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.inputBackground,
            borderColor,
            borderRadius: br.xl, // Increase border radius
            borderWidth: isFocused ? 1.5 : 1,
            // Subtle shadow for standard inputs when not focused/error
            ...(!isFocused && !error
              ? {
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.5,
                  shadowRadius: 4,
                  elevation: 2,
                }
              : {}),
          },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={isFocused ? colors.primary : colors.textTertiary}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: fs.md,
            },
            multiline && styles.multiline,
          ]}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.danger, fontSize: fs.xs }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: "500",
    marginLeft: 4,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
  },
  leftIcon: {
    marginLeft: 14,
    marginRight: 2,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  eyeIcon: {
    paddingHorizontal: 14,
  },
  error: {
    marginTop: 4,
    marginLeft: 4,
  },
});

export default React.memo(Input);
