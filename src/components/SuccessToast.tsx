import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  PanResponder,
  AccessibilityInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { formatCurrency } from "../utils/money";
import type { ToastType } from "../utils/notifyLogic";

/**
 * The app's toast (T-026): success, error, warning and info.
 * The file keeps its old name so existing imports don't churn.
 */
interface SuccessToastProps {
  visible: boolean;
  /** Changes on every show, so the same text twice still animates and announces. */
  seq?: number;
  message: string;
  title?: string;
  amount?: number;
  type?: ToastType;
  onDismiss?: () => void;
}

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "close-circle",
  warning: "warning",
  info: "information-circle",
};

const HIDDEN_Y = -160;

const SuccessToast: React.FC<SuccessToastProps> = ({
  visible,
  seq,
  message,
  title,
  amount,
  type = "success",
  onDismiss,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(HIDDEN_Y)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Stay mounted until the exit animation finishes, so dismissal animates.
  const [mounted, setMounted] = useState(visible);

  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Swipe up to dismiss; a small drag springs back.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
        onPanResponderMove: (_, g) => {
          if (g.dy < 0) slideAnim.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy < -24 || g.vy < -0.5) {
            dismissRef.current?.();
          } else {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [slideAnim],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideAnim.setValue(HIDDEN_Y);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Screen readers don't announce a view appearing.
      AccessibilityInfo.announceForAccessibility?.(title ? `${title}. ${message}` : message);
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: HIDDEN_Y,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, seq]);

  if (!mounted) return null;

  const accent = {
    success: colors.success,
    error: colors.danger,
    warning: colors.warning,
    info: colors.info,
  }[type];

  // Success and error keep their solid fill (white text passes contrast on
  // both). Warning amber and info blue are too light for white text, so they
  // use a surface card with a coloured edge and icon instead.
  const solid = type === "success" || type === "error";
  const bg = solid ? accent : colors.surfaceElevated;
  const fg = solid ? "#fff" : colors.text;
  const fgSub = solid ? "rgba(255,255,255,0.92)" : colors.textSecondary;
  const amountText = amount !== undefined ? `, ${formatCurrency(amount)}` : "";

  return (
    <Animated.View
      pointerEvents="box-none"
      {...pan.panHandlers}
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: bg,
          borderLeftColor: accent,
          borderLeftWidth: solid ? 0 : 4,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Pressable
        onPress={onDismiss}
        style={styles.content}
        accessibilityRole="button"
        accessibilityLabel={`${title ? `${title}. ` : ""}${message}${amountText}. Tap to dismiss.`}
      >
        <Ionicons name={ICONS[type]} size={24} color={solid ? "#fff" : accent} />
        <View style={styles.textContainer}>
          {title ? <Text style={[styles.title, { color: fg }]}>{title}</Text> : null}
          <Text style={[title ? styles.body : styles.message, { color: title ? fgSub : fg }]}>
            {message}
          </Text>
          {amount !== undefined && (
            <Text style={[styles.amount, { color: fg }]}>{formatCurrency(amount)}</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  message: {
    fontSize: 15,
    fontWeight: "600",
  },
  body: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  amount: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
});

export default SuccessToast;
