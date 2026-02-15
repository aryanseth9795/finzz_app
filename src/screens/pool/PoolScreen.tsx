import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper } from "../../components/ui";

const PoolScreen = () => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;

  return (
    <SafeAreaWrapper edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs.xxl }]}
        >
          Pool
        </Text>
      </View>

      {/* Coming Soon */}
      <View style={styles.content}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.primarySurface },
          ]}
        >
          <Ionicons
            name="people-circle-outline"
            size={56}
            color={colors.primary}
          />
        </View>
        <Text style={[styles.title, { color: colors.text, fontSize: fs.xl }]}>
          Coming Soon
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.textTertiary, fontSize: fs.md },
          ]}
        >
          Pool money with friends for{"\n"}trips, events & shared expenses
        </Text>
        <View
          style={[
            styles.featureList,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          {[
            { icon: "cash-outline" as const, text: "Create shared pools" },
            { icon: "people-outline" as const, text: "Add contributors" },
            { icon: "pie-chart-outline" as const, text: "Track who paid what" },
            {
              icon: "calculator-outline" as const,
              text: "Auto-split expenses",
            },
          ].map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name={feature.icon} size={18} color={colors.primary} />
              <Text
                style={[
                  styles.featureText,
                  { color: colors.textSecondary, fontSize: fs.sm },
                ]}
              >
                {feature.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  featureList: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    fontWeight: "500",
  },
});

export default PoolScreen;
