import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StaticInfoScreen from "./StaticInfoScreen";
import { privacySections } from "../../constants/accountContent";
import { PRIVACY_PATH, TERMS_PATH } from "../../constants/links";
import { openSitePage } from "../../utils/siteLinks";
import { useTheme } from "../../contexts/ThemeContext";

const PrivacyScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;

  const linkRow = (label: string, path: string) => (
    <TouchableOpacity
      key={path}
      onPress={() => openSitePage(path)}
      accessibilityRole="link"
      activeOpacity={0.6}
      style={[
        styles.linkRow,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <Text style={{ color: colors.primary, fontSize: fs.md, fontWeight: "600" }}>
        {label}
      </Text>
      <Ionicons name="open-outline" size={18} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <StaticInfoScreen
      navigation={navigation}
      title="Privacy"
      icon="shield-checkmark-outline"
      sections={privacySections}
      footer={
        <View style={styles.links}>
          {linkRow("Full privacy policy", PRIVACY_PATH)}
          {linkRow("Terms of service", TERMS_PATH)}
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  links: { gap: 12 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
});

export default PrivacyScreen;
