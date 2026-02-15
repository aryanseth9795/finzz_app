import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Button } from "../../components/ui";

const { width } = Dimensions.get("window");

const LandingScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs, spacing: sp } = theme;

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        {/* Top section with branding */}
        <View style={styles.topSection}>
          <View
            style={[
              styles.logoContainer,
              { backgroundColor: colors.primarySurface },
            ]}
          >
            <Ionicons name="wallet-outline" size={48} color={colors.primary} />
          </View>
          <Text
            style={[
              styles.appName,
              { color: colors.text, fontSize: fs.display },
            ]}
          >
            Finzz
          </Text>
          <Text
            style={[
              styles.tagline,
              { color: colors.textTertiary, fontSize: fs.lg },
            ]}
          >
            Track transactions with friends
          </Text>
        </View>

        {/* Middle section with features */}
        <View style={styles.featuresSection}>
          {[
            {
              icon: "swap-horizontal-outline" as const,
              text: "Record transactions instantly",
            },
            { icon: "people-outline" as const, text: "Connect with friends" },
            {
              icon: "bar-chart-outline" as const,
              text: "Smart reports & analytics",
            },
          ].map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: colors.primarySurface },
                ]}
              >
                <Ionicons
                  name={feature.icon}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.featureText,
                  { color: colors.textSecondary, fontSize: fs.md },
                ]}
              >
                {feature.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Bottom section with buttons */}
        <View style={styles.bottomSection}>
          <Button
            title="Get Started"
            onPress={() => navigation.navigate("Register")}
            variant="primary"
            size="lg"
            fullWidth
          />
          <Button
            title="I already have an account"
            onPress={() => navigation.navigate("Login")}
            variant="ghost"
            size="md"
            fullWidth
          />
        </View>
      </View>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  appName: {
    fontWeight: "800",
    letterSpacing: -1,
  },
  tagline: {
    marginTop: 8,
    fontWeight: "400",
    textAlign: "center",
  },
  featuresSection: {
    paddingVertical: 24,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontWeight: "500",
  },
  bottomSection: {
    paddingBottom: 16,
    gap: 8,
  },
});

export default LandingScreen;
