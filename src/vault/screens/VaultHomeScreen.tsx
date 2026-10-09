import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { useVault } from "../VaultContext";
import { addGroup, filterEntries, newId, sortedGroups, VaultEntry, VaultValidationError } from "../model";
import { randomBytes } from "../random";
import { copySecret } from "../clipboard";
import GroupEditorModal from "../components/GroupEditorModal";

const VaultHomeScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { showSuccessToast, showErrorToast } = useToast();
  const vault = useVault();
  const data = vault.data!;
  const [selected, setSelected] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);

  const groups = sortedGroups(data);
  // The selected group may have been deleted from Settings: fall back to All.
  const activeGroup = selected !== "all" && !groups.some((g) => g.id === selected) ? "all" : selected;
  const entries = useMemo(() => filterEntries(data, activeGroup, query), [data, activeGroup, query]);

  const copy = async (value: string, what: string) => {
    if (!value) return showErrorToast(`No ${what} saved`);
    try {
      await copySecret(value);
      showSuccessToast(`${what} copied · clears in 30s`);
    } catch {
      showErrorToast("Couldn't copy");
    }
  };

  const chip = (id: string | "all", label: string, icon?: string) => {
    const on = activeGroup === id;
    return (
      <TouchableOpacity
        key={id}
        onPress={() => setSelected(id)}
        style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surface, borderColor: colors.border }]}
      >
        {icon ? <Ionicons name={icon as any} size={14} color={on ? "#FFFFFF" : colors.textSecondary} /> : null}
        <Text style={[styles.chipText, { color: on ? "#FFFFFF" : colors.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderEntry = ({ item }: { item: VaultEntry }) => (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => navigation.navigate("VaultEntry", { entryId: item.id })}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        {item.loginValue ? (
          <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.loginLabel}: {item.loginValue}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity style={styles.iconBtn} onPress={() => copy(item.loginValue, item.loginLabel)} accessibilityLabel={`Copy ${item.loginLabel}`}>
        <Ionicons name="person-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={() => copy(item.password, "Password")} accessibilityLabel="Copy password">
        <Ionicons name="key-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Vault</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate("VaultSettings")} accessibilityLabel="Vault settings">
            <Ionicons name="settings-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={vault.lock} accessibilityLabel="Lock vault">
            <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chip("all", "All")}
          {groups.map((g) => chip(g.id, g.name, g.icon))}
          <TouchableOpacity
            onPress={() => setAddingGroup(true)}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="Add group"
          >
            <Ionicons name="add" size={16} color={colors.primary} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={colors.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        renderItem={renderEntry}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="key-outline" size={56} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {query ? "No matches" : "Add your first password"}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate("VaultEditEntry", { groupId: activeGroup === "all" ? undefined : activeGroup })}
        accessibilityLabel="Add password"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <GroupEditorModal
        visible={addingGroup}
        title="New group"
        onCancel={() => setAddingGroup(false)}
        onSave={async (name, icon) => {
          const id = newId(randomBytes);
          try {
            await vault.save((d) => addGroup(d, name, icon, id));
            setAddingGroup(false);
            setSelected(id);
            return null;
          } catch (e) {
            return e instanceof VaultValidationError ? e.message : "Couldn't save. Please try again.";
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 18 },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: "600" },
  search: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16,
    paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  list: { padding: 16, gap: 10, paddingBottom: 100 },
  row: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 4 },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  rowSub: { fontSize: 13, marginTop: 2 },
  iconBtn: { padding: 8 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15 },
  fab: {
    position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center", elevation: 4,
  },
});

export default VaultHomeScreen;
