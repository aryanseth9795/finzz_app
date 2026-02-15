import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Avatar, Button } from "../../components/ui";
import { uploadAvatarApi, logoutApi } from "../../api/authApi";
import { tokenManager } from "../../utils/tokenManager";
import { cacheManager } from "../../utils/cacheManager";
import { useAppSelector, useAppDispatch } from "../../store";
import {
  updateAvatar,
  logout as logoutAction,
} from "../../store/slices/authSlice";
import { setLogoutCallback } from "../../api/axios";

const AccountScreen = ({ navigation }: any) => {
  const { theme, toggleTheme, isDark } = useTheme();
  const { colors, fontSize: fs, borderRadius: br } = theme;
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const response = await uploadAvatarApi(result.assets[0].uri);
        const updatedUser = response.data.user;
        dispatch(updateAvatar(updatedUser.avatar));
        await tokenManager.setUserData(JSON.stringify(updatedUser)); // Update cache
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      Alert.alert(
        "Upload Failed",
        error?.response?.data?.message || "Could not upload avatar",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutApi();
          } catch {
            // Logout even if API fails
          }
          await tokenManager.clearAll();
          await cacheManager.clearAll();
          dispatch(logoutAction());
        },
      },
    ]);
  };

  const menuItems = [
    {
      icon: "bar-chart-outline" as const,
      label: "Reports",
      onPress: () => navigation.navigate("Report", {}),
    },
    {
      icon: "notifications-outline" as const,
      label: "Notifications",
      onPress: () => {},
    },
    {
      icon: "shield-outline" as const,
      label: "Privacy",
      onPress: () => {},
    },
    {
      icon: "help-circle-outline" as const,
      label: "Help & Support",
      onPress: () => {},
    },
    {
      icon: "information-circle-outline" as const,
      label: "About Finzz",
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaWrapper edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.text, fontSize: fs.xxl },
            ]}
          >
            Account
          </Text>
        </View>

        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <TouchableOpacity
            onPress={handleAvatarUpload}
            style={styles.avatarWrapper}
          >
            <Avatar uri={user?.avatar} name={user?.name || "U"} size={72} />
            <View
              style={[styles.editBadge, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
            {uploading && (
              <View
                style={[
                  styles.uploadOverlay,
                  { backgroundColor: colors.overlay },
                ]}
              >
                <Text style={styles.uploadText}>...</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text
              style={[
                styles.profileName,
                { color: colors.text, fontSize: fs.xl },
              ]}
            >
              {user?.name}
            </Text>
            <Text
              style={[
                styles.profilePhone,
                { color: colors.textTertiary, fontSize: fs.md },
              ]}
            >
              {user?.phone}
            </Text>
          </View>
        </View>

        {/* Theme Toggle */}
        <View
          style={[
            styles.themeCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.themeLeft}>
            <View
              style={[
                styles.themeIcon,
                { backgroundColor: colors.primarySurface },
              ]}
            >
              <Ionicons
                name={isDark ? "moon" : "sunny"}
                size={20}
                color={colors.primary}
              />
            </View>
            <View>
              <Text
                style={[
                  styles.themeLabel,
                  { color: colors.text, fontSize: fs.md },
                ]}
              >
                Dark Mode
              </Text>
              <Text
                style={[
                  styles.themeSubtext,
                  { color: colors.textTertiary, fontSize: fs.sm },
                ]}
              >
                {isDark ? "On" : "Off"}
              </Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={() => {
              toggleTheme();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Menu Items */}
        <View
          style={[
            styles.menuSection,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={item.onPress}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && {
                  borderBottomColor: colors.separatorLight,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: colors.primarySurface },
                ]}
              >
                <Ionicons name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text
                style={[
                  styles.menuLabel,
                  { color: colors.text, fontSize: fs.md },
                ]}
              >
                {item.label}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutButton, { backgroundColor: colors.dangerLight }]}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text
            style={[
              styles.logoutText,
              { color: colors.danger, fontSize: fs.md },
            ]}
          >
            Logout
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            styles.version,
            { color: colors.textTertiary, fontSize: fs.xs },
          ]}
        >
          Finzz v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    // borderBottomWidth: StyleSheet.hairlineWidth, // Clean header
  },
  headerTitle: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 24,
    padding: 24,
    borderRadius: 24,
    // Shadow for profile card
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 0, // Remove border if using shadow
  },
  avatarWrapper: {
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 18,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 20,
  },
  profileName: {
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  profilePhone: {
    opacity: 0.7,
  },
  themeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  themeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  themeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  themeLabel: {
    fontWeight: "600",
  },
  themeSubtext: {
    marginTop: 2,
  },
  menuSection: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 24,
    gap: 10,
  },
  logoutText: {
    fontWeight: "700",
  },
  version: {
    textAlign: "center",
    marginTop: 24,
    opacity: 0.5,
  },
});

export default AccountScreen;
