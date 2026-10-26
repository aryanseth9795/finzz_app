import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { AppRelease } from "../../utils/version";

interface Props {
  release: AppRelease;
  installedVersion: string;
}

/** Full-screen, non-dismissible: shown instead of all navigation. */
const ForceUpdateScreen = ({ release, installedVersion }: Props) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [error, setError] = useState<string | null>(null);

  // Hardware back must not escape the gate.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const download = async () => {
    setError(null);
    if (!release.apkUrl) {
      setError("The download link isn't available yet. Please try again later.");
      return;
    }
    try {
      await Linking.openURL(release.apkUrl);
    } catch {
      setError("Couldn't open the download link. Check that a browser is installed.");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySurface }]}>
          <Ionicons name="cloud-download-outline" size={44} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Update required</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Finzz v{release.minSupportedVersion} or newer is required. You have v
          {installedVersion}.
        </Text>

        {release.releaseNotes ? (
          <View
            style={[
              styles.notes,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.notesTitle, { color: colors.text }]}>What's new</Text>
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>
              {release.releaseNotes}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={download}
          accessibilityRole="button"
        >
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Download update</Text>
        </TouchableOpacity>

        {error ? (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        ) : null}

        <Text style={[styles.help, { color: colors.textTertiary }]}>
          After the download finishes, open it and tap Install. If Android asks,
          allow installing from your browser. Then reopen Finzz.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  notes: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  notesTitle: { fontSize: 15, fontWeight: "700" },
  notesText: { fontSize: 14, lineHeight: 20 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  error: { fontSize: 14, textAlign: "center" },
  help: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});

export default ForceUpdateScreen;
