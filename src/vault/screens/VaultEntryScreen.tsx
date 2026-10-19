import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { useVault } from "../VaultContext";
import { deleteEntry, groupName } from "../model";
import { copySecret } from "../clipboard";

const VaultEntryScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { showSuccessToast, showErrorToast } = useToast();
  const vault = useVault();
  const entry = vault.data?.entries.find((e) => e.id === route.params?.entryId);
  const [showPassword, setShowPassword] = useState(false);

  if (!entry) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, padding: 24 }}>This entry no longer exists.</Text>
      </SafeAreaView>
    );
  }

  const copy = async (value: string, what: string) => {
    try {
      await copySecret(value);
      showSuccessToast(`${what} copied · clears in 30s`);
    } catch {
      showErrorToast("Couldn't copy");
    }
  };

  const remove = () =>
    Alert.alert("Delete password?", `"${entry.title}" will be removed from the vault.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await vault.save((d) => deleteEntry(d, entry.id));
            navigation.goBack();
          } catch {
            showErrorToast("Couldn't delete. Please try again.");
          }
        },
      },
    ]);

  const field = (label: string, value: string, opts: { secret?: boolean; multiline?: boolean } = {}) => {
    if (!value) return null;
    const masked = opts.secret && !showPassword;
    return (
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[styles.fieldValue, { color: colors.text }]} selectable={!opts.secret}>
            {masked ? "••••••••••" : value}
          </Text>
        </View>
        {opts.secret ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowPassword((s) => !s)} accessibilityLabel={showPassword ? "Hide" : "Show"}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.iconBtn} onPress={() => copy(value, label)} accessibilityLabel={`Copy ${label}`}>
          <Ionicons name="copy-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{entry.title}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate("VaultEditEntry", { entryId: entry.id })} accessibilityLabel="Edit">
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={remove} accessibilityLabel="Delete">
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {field(entry.loginLabel, entry.loginValue)}
        {field("Password", entry.password, { secret: true })}
        {field("Notes", entry.notes, { multiline: true })}
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          {groupName(vault.data!, entry.groupId)} · Updated {new Date(entry.updatedAt).toLocaleDateString()}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 16 },
  content: { padding: 16, gap: 12 },
  field: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  fieldValue: { fontSize: 16 },
  iconBtn: { padding: 8 },
  meta: { fontSize: 12, textAlign: "center", marginTop: 8 },
});

export default VaultEntryScreen;
