import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { IExpenseCategory } from "../../types";

// Chips shown before "+N" expands the rest.
const COLLAPSED_COUNT = 8;
// "1" once the long-press hint has been dismissed or a chip long-pressed.
const HINT_SEEN_KEY = "expense_category_chip_hint_seen";

interface CategoryChipsProps {
  chips: IExpenseCategory[]; // already filtered and sorted by the screen
  selectedId: string | null; // chip shown filled
  onPick: (name: string) => void;
  onRemove: (category: IExpenseCategory) => Promise<void>;
}

/**
 * Category suggestions under the Category field. Tap fills the field,
 * long-press asks to remove the suggestion. The list itself is owned by the
 * screen; this only renders it.
 */
export default function CategoryChips({
  chips,
  selectedId,
  onPick,
  onRemove,
}: CategoryChipsProps): React.JSX.Element | null {
  const { theme } = useTheme();
  const { colors } = theme;

  const [expanded, setExpanded] = useState(false);
  const [showHint, setShowHint] = useState(false);
  // Set once the hint is known seen, so it is never shown or written twice.
  const hintSeen = useRef(false);

  // Collapse again once the list no longer needs a "+N".
  useEffect(() => {
    if (chips.length <= COLLAPSED_COUNT) setExpanded(false);
  }, [chips.length]);

  // The hint stays hidden if storage can't be read: a hint that can't be
  // remembered would come back on every visit.
  useEffect(() => {
    let cancelled = false;
    const loadHint = async () => {
      try {
        const seen = await AsyncStorage.getItem(HINT_SEEN_KEY);
        if (seen === "1") hintSeen.current = true;
        else if (!cancelled && !hintSeen.current) setShowHint(true);
      } catch {
        // Chips still render without the hint.
      }
    };
    void loadHint();
    return () => {
      cancelled = true;
    };
  }, []);

  const markHintSeen = useCallback(async () => {
    setShowHint(false);
    if (hintSeen.current) return;
    hintSeen.current = true;
    try {
      await AsyncStorage.setItem(HINT_SEEN_KEY, "1");
    } catch {
      // Hidden for this visit; it may show again next time.
    }
  }, []);

  const confirmRemove = (chip: IExpenseCategory) => {
    void markHintSeen();
    Alert.alert(
      `Remove "${chip.name}"?`,
      "It won't show in suggestions. Past expenses keep it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void onRemove(chip),
        },
      ],
    );
  };

  if (chips.length === 0) return null;

  const hiddenCount = expanded ? 0 : Math.max(0, chips.length - COLLAPSED_COUNT);
  const visible = hiddenCount > 0 ? chips.slice(0, COLLAPSED_COUNT) : chips;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {visible.map((chip) => {
          const selected = chip._id === selectedId;
          return (
            <TouchableOpacity
              key={chip._id}
              style={[
                styles.chip,
                selected
                  ? {
                      backgroundColor: colors.primarySurface,
                      borderColor: colors.primary,
                    }
                  : {
                      backgroundColor: colors.surface,
                      borderColor: colors.inputBorder,
                    },
              ]}
              onPress={() => onPick(chip.name)}
              onLongPress={() => confirmRemove(chip)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={chip.name}
              accessibilityHint="Fills the category. Long-press to remove it."
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? colors.primary : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {chip.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {hiddenCount > 0 && (
          <TouchableOpacity
            style={[
              styles.chip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.inputBorder,
              },
            ]}
            onPress={() => setExpanded(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Show ${hiddenCount} more categories`}
          >
            <Text
              style={[
                styles.chipText,
                styles.moreText,
                { color: colors.textSecondary },
              ]}
            >
              +{hiddenCount}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {showHint && (
        <View style={styles.hint}>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Long-press a chip to remove it.
          </Text>
          <TouchableOpacity
            onPress={() => void markHintSeen()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss hint"
          >
            <Ionicons name="close" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  moreText: { fontWeight: "600" },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  hintText: { fontSize: 12 },
});
