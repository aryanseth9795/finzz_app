import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { PaymentMode } from "../../types";
import {
  PAYMENT_METHODS,
  PAYMENT_MODES,
  nextPaymentChoice,
  type PaymentChoice,
  type PaymentTap,
} from "../../utils/paymentMode";

// Text/icons on the selected fill stay white; the theme has no on-primary token.
const ON_ACCENT = "#FFFFFF";
// Row 2 chips are shorter; this brings their touch target up to 44dp
// without reaching into the next wrapped line (the row gap is 8).
const METHOD_HIT_SLOP = { top: 4, bottom: 4 };

const MODE_ICONS: Record<PaymentMode, keyof typeof Ionicons.glyphMap> = {
  cash: "cash-outline",
  online: "phone-portrait-outline",
};

const MODE_A11Y_LABELS: Record<PaymentMode, string> = {
  cash: "Pay by cash",
  online: "Pay online",
};

const CLEAR_HINT = "Double tap again to clear";

interface PaymentModePickerProps {
  value: PaymentChoice; // chips shown filled
  onChange: (next: PaymentChoice) => void;
}

/**
 * Payment mode chips under the "Payment mode (optional)" label: Cash or
 * Online, and under Online a wrapping row of methods. Tapping a selected chip
 * clears it. The choice is owned by the screen; this only renders it.
 */
export default function PaymentModePicker({
  value,
  onChange,
}: PaymentModePickerProps): React.JSX.Element {
  const { theme } = useTheme();
  const { colors } = theme;

  const tap = (next: PaymentTap) => onChange(nextPaymentChoice(value, next));

  const chipColors = (selected: boolean) =>
    selected
      ? { backgroundColor: colors.primary, borderColor: colors.primary }
      : {
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
        };

  return (
    <View>
      <View style={styles.modeRow}>
        {PAYMENT_MODES.map((mode) => {
          const selected = value.mode === mode.value;
          return (
            <TouchableOpacity
              key={mode.value}
              style={[styles.chip, styles.modeChip, chipColors(selected)]}
              onPress={() => tap({ kind: "mode", value: mode.value })}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={MODE_A11Y_LABELS[mode.value]}
              accessibilityHint={selected ? CLEAR_HINT : undefined}
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={MODE_ICONS[mode.value]}
                size={18}
                color={selected ? ON_ACCENT : colors.textSecondary}
              />
              <Text
                style={[
                  styles.modeText,
                  { color: selected ? ON_ACCENT : colors.text },
                ]}
                numberOfLines={1}
              >
                {mode.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {value.mode === "online" && (
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((method) => {
            const selected = value.method === method.value;
            return (
              <TouchableOpacity
                key={method.value}
                style={[styles.chip, styles.methodChip, chipColors(selected)]}
                onPress={() => tap({ kind: "method", value: method.value })}
                activeOpacity={0.7}
                hitSlop={METHOD_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`Online, ${method.label}`}
                accessibilityHint={selected ? CLEAR_HINT : undefined}
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.methodText,
                    { color: selected ? ON_ACCENT : colors.text },
                  ]}
                >
                  {method.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", gap: 8 },
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
  },
  modeChip: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  methodChip: {
    maxWidth: "100%",
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  modeText: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  methodText: { fontSize: 13, fontWeight: "500" },
});
