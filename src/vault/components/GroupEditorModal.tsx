import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import VaultTextInput from "./VaultTextInput";
import { GROUP_ICONS } from "../model";

interface Props {
  visible: boolean;
  title: string;
  initialName?: string;
  initialIcon?: string;
  onCancel(): void;
  /** Resolve with an error message to keep the modal open, or null on success. */
  onSave(name: string, icon: string): Promise<string | null>;
}

const GroupEditorModal = ({ visible, title, initialName = "", initialIcon = "folder", onCancel, onSave }: Props) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setIcon(initialIcon);
      setError(null);
    }
  }, [visible, initialName, initialIcon]);

  const save = async () => setError(await onSave(name, icon));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <VaultTextInput label="Name" value={name} onChangeText={setName} maxLength={30} autoFocus />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.icons}>
            {GROUP_ICONS.map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setIcon(i)}
                style={[styles.iconBtn, { backgroundColor: icon === i ? colors.primary : colors.surfaceSecondary }]}
              >
                <Ionicons name={i as any} size={20} color={icon === i ? "#FFFFFF" : colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.btn}>
              <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={styles.btn}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  card: { borderRadius: 16, padding: 20, gap: 14 },
  title: { fontSize: 18, fontWeight: "700" },
  icons: { gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 10 },
});

export default GroupEditorModal;
