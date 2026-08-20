import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  AccessibilityInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { formatCurrency } from "../utils/money";

interface SuccessToastProps {
  visible: boolean;
  message: string;
  amount?: number;
  type?: "success" | "error";
  onDismiss?: () => void;
}

const SuccessToast: React.FC<SuccessToastProps> = ({
  visible,
  message,
  amount,
  type = "success",
  onDismiss,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  /**
   * `mounted` decouples "should be shown" from "is still on screen".
   *
   * The component previously ran `if (!visible) return null` immediately after
   * starting the exit animation, so the view was unmounted on the same render
   * and the animation never played — the entire `else` branch was dead code.
   * The toast simply vanished.
   *
   * Keeping it mounted until the exit animation calls back is what lets the
   * dismissal actually animate.
   */
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Screen readers do not announce a view appearing. Without this the
      // confirmation that a transaction saved is invisible to VoiceOver and
      // TalkBack users.
      AccessibilityInfo.announceForAccessibility?.(message);
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
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
  }, [visible, message]);

  if (!mounted) return null;

  const backgroundColor = type === "success" ? colors.success : colors.danger;
  const icon = type === "success" ? "checkmark-circle" : "close-circle";

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          backgroundColor,
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
        accessibilityLabel={`${message}${amount !== undefined ? `, ${formatCurrency(amount)}` : ""}. Tap to dismiss.`}
      >
        <Ionicons name={icon} size={24} color="#fff" />
        <View style={styles.textContainer}>
          <Text style={styles.message}>{message}</Text>
          {amount !== undefined && (
            <Text style={styles.amount}>{formatCurrency(amount)}</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
  message: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  amount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 2,
  },
});

export default SuccessToast;
