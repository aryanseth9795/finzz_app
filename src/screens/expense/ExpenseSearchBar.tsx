import React from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

// The server takes search text of at most 50 characters.
const MAX_QUERY_LENGTH = 50;

interface ExpenseSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void; // "Cancel": the screen hides the bar and drops the text
  autoFocus?: boolean;
}

/**
 * The search field above the Expenses list. It only renders the text; the
 * screen owns it, waits for a pause in typing and runs the search.
 */
export default function ExpenseSearchBar({
  value,
  onChangeText,
  onClose,
  autoFocus = false,
}: ExpenseSearchBarProps): React.JSX.Element {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder="Search remarks or categories"
          placeholderTextColor={colors.inputPlaceholder}
          returnKeyType="search"
          maxLength={MAX_QUERY_LENGTH}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search expenses"
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close search"
      >
        <Text
          style={[styles.cancelText, { color: colors.primary }]}
          numberOfLines={1}
        >
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  // minWidth 0 lets the field give way to "Cancel" on narrow screens.
  box: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 0 },
  cancelText: { fontSize: 15, fontWeight: "600" },
});
