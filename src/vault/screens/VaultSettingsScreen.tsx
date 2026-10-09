import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { useVault } from "../VaultContext";
import { VaultGroup, VaultValidationError, deleteGroup, moveGroup, sortedGroups, updateGroup } from "../model";
import GroupEditorModal from "../components/GroupEditorModal";
import SecretForm from "../components/SecretForm";
import ConfirmResetModal from "../components/ConfirmResetModal";
import VaultTextInput from "../components/VaultTextInput";
import type { SecretType } from "../crypto";

const VaultSettingsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { showSuccessToast, showErrorToast } = useToast();
  const vault = useVault();
  const data = vault.data!;
  const [editing, setEditing] = useState<VaultGroup | null>(null);
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const run = async (mutate: Parameters<typeof vault.save>[0]) => {
    try {
      await vault.save(mutate);
    } catch (e) {
      showErrorToast(e instanceof VaultValidationError ? e.message : "Couldn't save. Please try again.");
    }
  };

  const askDelete = (g: VaultGroup) => {
    const count = data.entries.filter((e) => e.groupId === g.id).length;
    if (count === 0) {
      return Alert.alert("Delete group?", `"${g.name}" will be removed.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => run((d) => deleteGroup(d, g.id, "keepEntries")) },
      ]);
    }
    Alert.alert("Delete group?", `"${g.name}" has ${count} password${count === 1 ? "" : "s"}.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Keep passwords", onPress: () => run((d) => deleteGroup(d, g.id, "keepEntries")) },
      { text: `Delete all ${count}`, style: "destructive", onPress: () => run((d) => deleteGroup(d, g.id, "deleteEntries")) },
    ]);
  };

  const changeSecret = async (type: SecretType, next: string) => {
    if (!current) return setChangeError("Enter your current PIN or password");
    setBusy(true);
    setChangeError(null);
    try {
      const r = await vault.changeSecret(current, type, next);
      if (r === "ok") {
        setChanging(false);
        setCurrent("");
        showSuccessToast(type === "pin" ? "PIN changed" : "Password changed");
      } else {
        setChangeError(r === "throttled" ? "Too many attempts. Please wait." : "Current PIN or password is wrong");
      }
    } catch {
      setChangeError("Couldn't change it. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const groups = sortedGroups(data);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Vault settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, { color: colors.textSecondary }]}>GROUPS</Text>
        {groups.length === 0 ? (
          <Text style={{ color: colors.textTertiary }}>No groups yet. Add one with + on the vault screen.</Text>
        ) : null}
        {groups.map((g, i) => (
          <View key={g.id} style={[styles.groupRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name={g.icon as any} size={18} color={colors.textSecondary} />
            <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>{g.name}</Text>
            <TouchableOpacity disabled={i === 0} onPress={() => run((d) => moveGroup(d, g.id, -1))} accessibilityLabel="Move up">
              <Ionicons name="chevron-up" size={20} color={i === 0 ? colors.border : colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity disabled={i === groups.length - 1} onPress={() => run((d) => moveGroup(d, g.id, 1))} accessibilityLabel="Move down">
              <Ionicons name="chevron-down" size={20} color={i === groups.length - 1 ? colors.border : colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(g)} accessibilityLabel="Edit group">
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => askDelete(g)} accessibilityLabel="Delete group">
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.section, { color: colors.textSecondary }]}>SECURITY</Text>
        {changing ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <VaultTextInput
              label={vault.secretType === "pin" ? "Current PIN" : "Current password"}
              secure
              value={current}
              onChangeText={setCurrent}
              keyboardType={vault.secretType === "pin" ? "number-pad" : "default"}
            />
            <SecretForm
              submitLabel="Change"
              busy={busy}
              initialType={vault.secretType ?? "pin"}
              onSubmit={changeSecret}
            />
            {changeError ? <Text style={{ color: colors.danger }}>{changeError}</Text> : null}
            <TouchableOpacity onPress={() => { setChanging(false); setCurrent(""); setChangeError(null); }}>
              <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setChanging(true)}>
            <Ionicons name="keypad-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>Change PIN or password</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={vault.lock}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.text }]}>Lock now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowReset(true)}>
          <Ionicons name="trash-bin-outline" size={20} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger }]}>Reset vault</Text>
        </TouchableOpacity>
      </ScrollView>

      <GroupEditorModal
        visible={editing !== null}
        title="Edit group"
        initialName={editing?.name}
        initialIcon={editing?.icon}
        onCancel={() => setEditing(null)}
        onSave={async (name, icon) => {
          if (!editing) return null;
          try {
            await vault.save((d) => updateGroup(d, editing.id, name, icon));
            setEditing(null);
            return null;
          } catch (e) {
            return e instanceof VaultValidationError ? e.message : "Couldn't save. Please try again.";
          }
        }}
      />
      <ConfirmResetModal
        visible={showReset}
        onCancel={() => setShowReset(false)}
        onConfirm={async () => {
          setShowReset(false);
          await vault.reset();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: "700" },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 8 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  groupName: { flex: 1, fontSize: 15, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  action: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  actionText: { fontSize: 15, fontWeight: "600" },
});

export default VaultSettingsScreen;
