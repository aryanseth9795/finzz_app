import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useVault } from "../VaultContext";
import { remainingMs } from "../throttle";
import SecretForm from "../components/SecretForm";
import VaultTextInput from "../components/VaultTextInput";
import ConfirmResetModal from "../components/ConfirmResetModal";

const VaultUnlockScreen = () => {
  const { theme } = useTheme();
  const { colors } = theme;
  const vault = useVault();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [now, setNow] = useState(Date.now());

  const waitMs = remainingMs(vault.throttle, now);
  useEffect(() => {
    if (waitMs <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitMs]);

  const isPin = vault.secretType === "pin";

  const create = async (type: "pin" | "password", value: string) => {
    setBusy(true);
    try {
      await vault.create(type, value);
    } catch {
      setError("Couldn't create the vault. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    if (busy || !secret) return;
    setBusy(true);
    setError(null);
    try {
      const r = await vault.unlock(secret);
      setNow(Date.now());
      if (r === "wrong") setError(isPin ? "Wrong PIN" : "Wrong password");
      if (r === "throttled") setError("Too many attempts. Please wait.");
      if (r === "unavailable") setUnavailable(true);
    } finally {
      setSecret("");
      setBusy(false);
    }
  };

  const minutes = Math.floor(waitMs / 60000);
  const seconds = Math.ceil((waitMs % 60000) / 1000);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.icon, { backgroundColor: colors.primarySurface }]}>
            <Ionicons name="lock-closed" size={40} color={colors.primary} />
          </View>

          {vault.status === "none" ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Create your vault</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                Passwords stay on this phone, encrypted with your PIN or password.
              </Text>
              <SecretForm submitLabel={busy ? "Securing…" : "Create vault"} busy={busy} onSubmit={create} />
            </>
          ) : unavailable ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Vault can't be opened</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                This vault was created on another install or device and can't be opened here. Reset it to start a
                new one.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Vault locked</Text>
              <View style={styles.form}>
                <VaultTextInput
                  label={isPin ? "PIN" : "Password"}
                  secure
                  value={secret}
                  onChangeText={setSecret}
                  keyboardType={isPin ? "number-pad" : "default"}
                  maxLength={isPin ? 6 : 128}
                  onSubmitEditing={unlock}
                  editable={waitMs <= 0 && !busy}
                />
                {waitMs > 0 ? (
                  <Text style={[styles.error, { color: colors.warning }]}>
                    Too many attempts. Try again in {minutes > 0 ? `${minutes}m ` : ""}{seconds}s.
                  </Text>
                ) : error ? (
                  <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.primary, opacity: busy || waitMs > 0 ? 0.6 : 1 }]}
                  onPress={unlock}
                  disabled={busy || waitMs > 0}
                >
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Unlock</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          {vault.status === "locked" ? (
            <TouchableOpacity onPress={() => setShowReset(true)}>
              <Text style={[styles.link, { color: colors.textTertiary }]}>
                {unavailable ? "Reset vault" : `Forgot your ${isPin ? "PIN" : "password"}? Reset vault`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmResetModal
        visible={showReset}
        onCancel={() => setShowReset(false)}
        onConfirm={async () => {
          setShowReset(false);
          setUnavailable(false);
          await vault.reset();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 },
  icon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  form: { gap: 12, alignSelf: "stretch" },
  error: { fontSize: 14 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  link: { fontSize: 13, marginTop: 8 },
});

export default VaultUnlockScreen;
