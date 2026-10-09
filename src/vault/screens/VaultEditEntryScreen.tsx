import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useVault } from "../VaultContext";
import {
  LOGIN_LABEL_PRESETS, VaultValidationError, addEntry, newId, sortedGroups, updateEntry,
} from "../model";
import { DEFAULT_GENERATOR, GeneratorOptions, generatePassword } from "../generator";
import { randomBytes } from "../random";
import VaultTextInput from "../components/VaultTextInput";

const VaultEditEntryScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const vault = useVault();
  const data = vault.data!;
  const existing = data.entries.find((e) => e.id === route.params?.entryId);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [groupId, setGroupId] = useState<string | null>(existing?.groupId ?? route.params?.groupId ?? null);
  const initialLabel = existing?.loginLabel ?? "Username";
  const [loginLabel, setLoginLabel] = useState(initialLabel);
  const [customLabel, setCustomLabel] = useState(!LOGIN_LABEL_PRESETS.includes(initialLabel));
  const [loginValue, setLoginValue] = useState(existing?.loginValue ?? "");
  const [password, setPassword] = useState(existing?.password ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [showGen, setShowGen] = useState(false);
  const [gen, setGen] = useState<GeneratorOptions>(DEFAULT_GENERATOR);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const input = { groupId, title, loginLabel, loginValue, password, notes };
    const now = new Date().toISOString();
    try {
      if (existing) {
        await vault.save((d) => updateEntry(d, existing.id, input, now));
      } else {
        const id = newId(randomBytes);
        await vault.save((d) => addEntry(d, input, id, now));
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof VaultValidationError ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const pill = (on: boolean, label: string, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: on ? colors.primary : colors.surface, borderColor: colors.border }]}
    >
      <Text style={{ color: on ? "#FFFFFF" : colors.text, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Cancel">
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{existing ? "Edit password" : "New password"}</Text>
        <TouchableOpacity onPress={save} disabled={saving} accessibilityLabel="Save">
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16, opacity: saving ? 0.5 : 1 }}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <VaultTextInput label="Title" value={title} onChangeText={setTitle} maxLength={60} placeholder="e.g. Instagram" />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
            {pill(groupId === null, "None", () => setGroupId(null))}
            {sortedGroups(data).map((g) => pill(groupId === g.id, g.name, () => setGroupId(g.id)))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Login type</Text>
          <View style={styles.wrapPills}>
            {LOGIN_LABEL_PRESETS.map((p) =>
              pill(!customLabel && loginLabel === p, p, () => {
                setCustomLabel(false);
                setLoginLabel(p);
              }),
            )}
            {pill(customLabel, "Custom…", () => {
              setCustomLabel(true);
              setLoginLabel(LOGIN_LABEL_PRESETS.includes(loginLabel) ? "" : loginLabel);
            })}
          </View>
          {customLabel ? (
            <VaultTextInput label="Custom label" value={loginLabel} onChangeText={setLoginLabel} maxLength={20} placeholder="e.g. Customer ID" />
          ) : null}
          <VaultTextInput label={loginLabel || "Login"} value={loginValue} onChangeText={setLoginValue} />

          <VaultTextInput label="Password" secure value={password} onChangeText={setPassword} />
          <TouchableOpacity onPress={() => setShowGen((s) => !s)} style={styles.genToggle}>
            <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "600" }}>Generate password</Text>
          </TouchableOpacity>
          {showGen ? (
            <View style={[styles.gen, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.genRow}>
                <Text style={{ color: colors.text }}>Length: {gen.length}</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity onPress={() => setGen((g) => ({ ...g, length: Math.max(8, g.length - 1) }))} accessibilityLabel="Shorter">
                    <Ionicons name="remove-circle-outline" size={26} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setGen((g) => ({ ...g, length: Math.min(64, g.length + 1) }))} accessibilityLabel="Longer">
                    <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              {(["upper", "digits", "symbols"] as const).map((k) => (
                <View key={k} style={styles.genRow}>
                  <Text style={{ color: colors.text }}>
                    {k === "upper" ? "Uppercase" : k === "digits" ? "Numbers" : "Symbols"}
                  </Text>
                  <Switch value={gen[k]} onValueChange={(v) => setGen((g) => ({ ...g, [k]: v }))} />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.useBtn, { backgroundColor: colors.primary }]}
                onPress={() => setPassword(generatePassword(gen, randomBytes))}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Generate & use</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <VaultTextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={2000}
            style={{ minHeight: 100, textAlignVertical: "top" }}
            placeholder="Recovery codes, security answers, anything else"
          />

          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: "700" },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  label: { fontSize: 13, fontWeight: "600" },
  pills: { gap: 8 },
  wrapPills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  genToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  gen: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  genRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepper: { flexDirection: "row", gap: 12 },
  useBtn: { paddingVertical: 10, borderRadius: 10, alignItems: "center", marginTop: 4 },
});

export default VaultEditEntryScreen;
