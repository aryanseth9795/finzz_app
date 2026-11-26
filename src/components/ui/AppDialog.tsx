import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import Button from "./Button";
import type { DialogAction, QueuedDialog } from "../../contexts/DialogContext";
import {
  dialogTone,
  dismissPlan,
  layoutActions,
  type DialogTone,
  type NormalizedAction,
} from "../../utils/notifyLogic";

interface Props {
  dialog: QueuedDialog | undefined;
  onAction: (key: number, action: NormalizedAction<DialogAction>) => void;
}

const TONE_ICON: Record<DialogTone, keyof typeof Ionicons.glyphMap> = {
  default: "information-circle-outline",
  info: "information-circle-outline",
  destructive: "alert-circle-outline",
  warning: "warning-outline",
  success: "checkmark-circle-outline",
};

/**
 * Themed dialog drawn by DialogProvider (T-026). An RN <Modal>, so it sits
 * above screens, sheets and other Modals (each Modal is its own window on
 * Android). Keeps the last dialog on screen while the Modal fades out.
 */
const AppDialog: React.FC<Props> = ({ dialog, onAction }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const lastRef = useRef<QueuedDialog | undefined>(dialog);
  if (dialog) lastRef.current = dialog;
  const shown = dialog ?? lastRef.current;

  const scale = useRef(new Animated.Value(0.94)).current;
  useEffect(() => {
    if (!dialog) return;
    scale.setValue(0.94);
    Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
    AccessibilityInfo.announceForAccessibility?.(
      dialog.message ? `${dialog.title}. ${dialog.message}` : dialog.title,
    );
  }, [dialog?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown) return null;

  const { actions } = shown;
  const plan = dismissPlan(actions);
  const layout = layoutActions(actions);
  const tone = dialogTone(actions, shown.tone);
  const toneColor = {
    default: colors.primary,
    info: colors.info,
    destructive: colors.danger,
    warning: colors.warning,
    success: colors.success,
  }[tone];
  const toneBg = {
    default: colors.primarySurface,
    info: colors.primarySurface,
    destructive: colors.dangerLight,
    warning: colors.warningLight,
    success: colors.successLight,
  }[tone];
  const icon = shown.icon === undefined ? TONE_ICON[tone] : shown.icon;

  const fire = (index: number | null) => {
    if (!dialog || index === null) return;
    onAction(dialog.key, actions[index]);
  };

  return (
    <Modal
      visible={!!dialog}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => fire(plan.backIndex)}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => fire(plan.backdropIndex)}
          accessible={false}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [{ scale }],
            },
          ]}
        >
          {icon ? (
            <View style={[styles.iconChip, { backgroundColor: toneBg }]}>
              <Ionicons name={icon} size={26} color={toneColor} />
            </View>
          ) : null}
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {shown.title}
          </Text>
          {shown.message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{shown.message}</Text>
          ) : null}

          <View style={layout.direction === "row" ? styles.row : styles.column}>
            {layout.order.map((i) => {
              const a = actions[i];
              const variant =
                a.style === "destructive" ? "danger" : a.style === "cancel" ? "secondary" : "primary";
              return (
                <Button
                  key={`${i}-${a.label}`}
                  title={a.label}
                  variant={variant}
                  size="md"
                  fullWidth={layout.direction === "column"}
                  style={layout.direction === "row" ? styles.rowButton : undefined}
                  onPress={() => fire(i)}
                />
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconChip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
    alignSelf: "stretch",
  },
  rowButton: {
    flex: 1,
  },
  column: {
    gap: 10,
    marginTop: 22,
    alignSelf: "stretch",
  },
});

export default AppDialog;
