import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Modal,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Avatar, Button } from "../../components/ui";
import {
  uploadAvatarApi,
  logoutApi,
  changePasswordApi,
} from "../../api/authApi";
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

  // Change Password modal state
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

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
        await tokenManager.setUserData(JSON.stringify(updatedUser));
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

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    setChangingPwd(true);
    try {
      await changePasswordApi(oldPassword, newPassword);
      Alert.alert("Success", "Password changed successfully!");
      setShowChangePwd(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to change password",
      );
    } finally {
      setChangingPwd(false);
    }
  };

  const menuItems = [
    {
      icon: "bar-chart-outline" as const,
      label: "Reports",
      onPress: () => navigation.navigate("Report", {}),
    },
    {
      icon: "key-outline" as const,
      label: "Change Password",
      onPress: () => setShowChangePwd(true),
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

  const pwdInput = (
    value: string,
    setter: (v: string) => void,
    placeholder: string,
    show: boolean,
    setShow: (v: boolean) => void,
  ) => (
    <View
      style={[
        styles.pwdInputWrapper,
        {
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
        },
      ]}
    >
      <Ionicons
        name="lock-closed-outline"
        size={18}
        color={colors.textTertiary}
        style={{ marginRight: 10 }}
      />
      <TextInput
        value={value}
        onChangeText={setter}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={!show}
        style={[styles.pwdTextInput, { color: colors.text }]}
      />
      <TouchableOpacity onPress={() => setShow(!show)}>
        <Ionicons
          name={show ? "eye-off-outline" : "eye-outline"}
          size={18}
          color={colors.textTertiary}
        />
      </TouchableOpacity>
    </View>
  );

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
            {/* Email row */}
            {user?.email ? (
              <View style={styles.emailRow}>
                <Ionicons
                  name="mail-outline"
                  size={13}
                  color={colors.textTertiary}
                />
                <Text
                  style={[
                    styles.emailText,
                    { color: colors.textTertiary, fontSize: fs.sm },
                  ]}
                >
                  {user.email}
                </Text>
                {user.emailVerified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={colors.success || "#22c55e"}
                  />
                )}
              </View>
            ) : (
              <View style={styles.emailRow}>
                <Ionicons name="mail-outline" size={13} color={colors.danger} />
                <Text style={[{ color: colors.danger, fontSize: fs.sm }]}>
                  Email not added
                </Text>
              </View>
            )}
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

      {/* Change Password Modal */}
      <Modal
        visible={showChangePwd}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChangePwd(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.separator },
            ]}
          >
            <TouchableOpacity onPress={() => setShowChangePwd(false)}>
              <Text style={[{ color: colors.textTertiary, fontSize: fs.md }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Change Password
            </Text>
            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={changingPwd}
            >
              <Text
                style={[
                  { color: colors.primary, fontSize: fs.md, fontWeight: "700" },
                ]}
              >
                {changingPwd ? "..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Ionicons
              name="key-outline"
              size={40}
              color={colors.primary}
              style={{ alignSelf: "center", marginBottom: 16 }}
            />
            <Text
              style={[styles.modalSubtitle, { color: colors.textTertiary }]}
            >
              Enter your current password and choose a new one.
            </Text>

            <Text style={[styles.pwdLabel, { color: colors.textSecondary }]}>
              Current Password
            </Text>
            {pwdInput(
              oldPassword,
              setOldPassword,
              "Enter current password",
              showOld,
              setShowOld,
            )}

            <Text style={[styles.pwdLabel, { color: colors.textSecondary }]}>
              New Password
            </Text>
            {pwdInput(
              newPassword,
              setNewPassword,
              "Min 6 characters",
              showNew,
              setShowNew,
            )}

            <Text style={[styles.pwdLabel, { color: colors.textSecondary }]}>
              Confirm New Password
            </Text>
            {pwdInput(
              confirmPassword,
              setConfirmPassword,
              "Confirm new password",
              false,
              () => {},
            )}

            <Button
              title="Change Password"
              onPress={handleChangePassword}
              loading={changingPwd}
              fullWidth
              size="lg"
              style={{ marginTop: 24 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  headerTitle: { fontWeight: "800", letterSpacing: -0.5 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 24,
    padding: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 0,
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
  uploadText: { color: "#FFF", fontWeight: "700", fontSize: 18 },
  profileInfo: { flex: 1, marginLeft: 20 },
  profileName: { fontWeight: "700", marginBottom: 4, letterSpacing: -0.5 },
  profilePhone: { opacity: 0.7, marginBottom: 4 },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  emailText: { flex: 1 },
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
  themeLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  themeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  themeLabel: { fontWeight: "600" },
  themeSubtext: { marginTop: 2 },
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
  menuLabel: { flex: 1, fontWeight: "600" },
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
  logoutText: { fontWeight: "700" },
  version: { textAlign: "center", marginTop: 24, opacity: 0.5 },
  // Modal styles
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalBody: { paddingHorizontal: 28, paddingTop: 28 },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 28,
  },
  pwdLabel: {
    marginBottom: 6,
    fontWeight: "500",
    marginLeft: 4,
    marginTop: 12,
  },
  pwdInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  pwdTextInput: { flex: 1, fontSize: 15 },
});

export default AccountScreen;
