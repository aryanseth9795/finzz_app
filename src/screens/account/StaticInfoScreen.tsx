import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaWrapper } from "../../components/ui";
import { useTheme } from "../../contexts/ThemeContext";

interface StaticInfoSection {
  title: string;
  body: string;
}

interface StaticInfoScreenProps {
  navigation: any;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  sections: StaticInfoSection[];
}

const StaticInfoScreen: React.FC<StaticInfoScreenProps> = ({
  navigation,
  title,
  icon,
  accentColor,
  sections,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const accent = accentColor || colors.primary;

  return (
    <SafeAreaWrapper edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs.lg }]}>
          {title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.heroIcon, { backgroundColor: accent + "20" }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text, fontSize: fs.xl }]}>
            {title}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary, fontSize: fs.sm }]}>
            Temporary content is in place so this screen is fully implemented and ready for final copy replacement.
          </Text>
        </View>

        {sections.map((section) => (
          <View
            key={section.title}
            style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs.md }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary, fontSize: fs.sm }]}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontWeight: "700",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontWeight: "800",
    marginBottom: 8,
  },
  heroSubtitle: {
    lineHeight: 20,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  sectionTitle: {
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionBody: {
    lineHeight: 20,
  },
});

export default StaticInfoScreen;
