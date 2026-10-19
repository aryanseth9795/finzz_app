import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import VaultTextInput from "./VaultTextInput";
import { validateSecret } from "../secret";
import type { SecretType } from "../crypto";

interface Props {
  submitLabel: string;
  busy: boolean;
  initialType?: SecretType;
  onSubmit(type: SecretType, secret: string): void;
}

const SecretForm = ({ submitLabel, busy, initialType = "pin", onSubmit }: Props) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [type, setType] = useState<SecretType>(initialType);
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const switchType = (t: SecretType) => {
    setType(t);
    setSecret("");
    setConfirm("");
    setError(null);
  };

  const submit = () => {
    const problem = validateSecret(type, secret);
    if (problem) return setError(problem);
    if (secret !== confirm) return setError(type === "pin" ? "PINs don't match" : "Passwords don't match");
    setError(null);
    onSubmit(type, secret);
  };

  const isPin = type === "pin";
  return (
    <View style={styles.form}>
      <View style={[styles.toggle, { backgroundColor: colors.surfaceSecondary }]}>
        {(["pin", "password"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.toggleBtn, type === t && { backgroundColor: colors.primary }]}
            onPress={() => switchType(t)}
          >
            <Text style={[styles.toggleText, { color: type === t ? "#FFFFFF" : colors.textSecondary }]}>
              {t === "pin" ? "PIN" : "Password"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <VaultTextInput
        label={isPin ? "PIN (4–6 digits)" : "Password (4+ characters)"}
        secure
        value={secret}
        onChangeText={setSecret}
        keyboardType={isPin ? "number-pad" : "default"}
        maxLength={isPin ? 6 : 128}
      />
      <VaultTextInput
        label={isPin ? "Confirm PIN" : "Confirm password"}
        secure
        value={confirm}
        onChangeText={setConfirm}
        keyboardType={isPin ? "number-pad" : "default"}
        maxLength={isPin ? 6 : 128}
      />

      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        A 6-digit PIN or a password is safer. There is no way to recover a forgotten one.
      </Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.submit, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{submitLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  form: { gap: 14, alignSelf: "stretch" },
  toggle: { flexDirection: "row", borderRadius: 10, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  toggleText: { fontSize: 14, fontWeight: "700" },
  hint: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 14 },
  submit: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

export default SecretForm;
