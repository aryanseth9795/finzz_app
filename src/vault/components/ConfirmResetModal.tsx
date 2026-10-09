import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface Props {
  visible: boolean;
  onCancel(): void;
  onConfirm(): void;
}

/** Typing DELETE is required: a reset destroys every saved password. */
const ConfirmResetModal = ({ visible, onCancel, onConfirm }: Props) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [typed, setTyped] = useState("");
  const close = () => {
    setTyped("");
    onCancel();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>Reset vault?</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            This permanently deletes every saved password on this phone. Type DELETE to confirm.
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="DELETE"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <View style={styles.actions}>
            <TouchableOpacity onPress={close} style={styles.btn}>
              <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={typed !== "DELETE"}
              onPress={() => {
                setTyped("");
                onConfirm();
              }}
              style={[styles.btn, { opacity: typed === "DELETE" ? 1 : 0.4 }]}
            >
              <Text style={{ color: colors.danger, fontWeight: "700" }}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  card: { borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 10 },
});

export default ConfirmResetModal;
