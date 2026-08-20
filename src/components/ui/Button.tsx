import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** Overrides the visible title as the accessible name. */
  accessibilityLabel?: string;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const { theme } = useTheme();
  const { colors, borderRadius: br } = theme;

  const handlePress = () => {
    // `impactAsync` returns a promise that rejects on devices with no haptic
    // engine. Unawaited and uncaught, that surfaced as an unhandled rejection.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    onPress();
  };

  const getButtonStyle = (): ViewStyle => {
    const base: ViewStyle = {
      borderRadius: br.full, // Pill shape
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      // Default shadow for primary/danger
      ...(variant === "primary" || variant === "danger"
        ? {
            shadowColor: variant === "primary" ? colors.primary : colors.danger,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }
        : {}),
    };

    // Size
    switch (size) {
      case "sm":
        base.paddingHorizontal = 16;
        base.paddingVertical = 10;
        break;
      case "lg":
        base.paddingHorizontal = 32;
        base.paddingVertical = 18;
        break;
      default:
        base.paddingHorizontal = 24;
        base.paddingVertical = 14;
    }

    // Variant
    switch (variant) {
      case "primary":
        base.backgroundColor = colors.primary;
        break;
      case "secondary":
        base.backgroundColor = colors.primarySurface;
        break;
      case "ghost":
        base.backgroundColor = "transparent";
        break;
      case "danger":
        base.backgroundColor = colors.danger;
        break;
    }

    if (disabled || loading) {
      base.opacity = 0.6;
      base.shadowOpacity = 0;
      base.elevation = 0;
    }

    if (fullWidth) {
      base.width = "100%";
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    const base: TextStyle = {
      fontWeight: "700",
      letterSpacing: 0.5,
    };

    switch (size) {
      case "sm":
        base.fontSize = 13;
        break;
      case "lg":
        base.fontSize = 17;
        break;
      default:
        base.fontSize = 15;
    }

    switch (variant) {
      case "primary":
      case "danger":
        base.color = "#FFFFFF";
        break;
      case "secondary":
        base.color = colors.primaryDark;
        break;
      case "ghost":
        base.color = colors.primary;
        break;
    }

    return base;
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[getButtonStyle(), style]}
      /**
       * Accessibility.
       *
       * There were zero accessibility annotations anywhere in the app, so a
       * disabled button was conveyed only by `opacity: 0.6` and a loading one
       * announced nothing at all. `accessibilityState` is what tells a screen
       * reader the control cannot currently be activated.
       */
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityHint={loading ? "In progress" : undefined}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary" || variant === "danger"
              ? "#FFFFFF"
              : colors.primary
          }
        />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default React.memo(Button);
