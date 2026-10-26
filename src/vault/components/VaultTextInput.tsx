import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useVault } from "../VaultContext";

interface Props extends TextInputProps {
  label: string;
  /** Masked with a show/hide toggle; disables OS suggestions and capture. */
  secure?: boolean;
}

const VaultTextInput = ({ label, secure, style, onChangeText, ...rest }: Props) => {
  const { theme } = useTheme();
  // Typing counts as activity: the idle lock must not discard a long draft.
  const { touch } = useVault();
  const { colors } = theme;
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          {...rest}
          onChangeText={(text) => {
            touch();
            onChangeText?.(text);
          }}
          style={[styles.input, { color: colors.text }, style]}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secure && hidden}
          autoCorrect={false}
          autoCapitalize="none"
          {...(secure ? { textContentType: "none" as const, autoComplete: "off" as const, importantForAutofill: "no" as const } : {})}
        />
        {secure ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.eye} accessibilityLabel={hidden ? "Show" : "Hide"}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10 },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 },
  eye: { paddingHorizontal: 12 },
});

export default VaultTextInput;
