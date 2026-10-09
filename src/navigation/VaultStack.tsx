import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { usePreventScreenCapture } from "expo-screen-capture";
import { useTheme } from "../contexts/ThemeContext";
import { VaultProvider, useVault } from "../vault/VaultContext";
import VaultUnlockScreen from "../vault/screens/VaultUnlockScreen";
import VaultHomeScreen from "../vault/screens/VaultHomeScreen";
import VaultEntryScreen from "../vault/screens/VaultEntryScreen";
import VaultEditEntryScreen from "../vault/screens/VaultEditEntryScreen";
import VaultSettingsScreen from "../vault/screens/VaultSettingsScreen";

const Stack = createNativeStackNavigator();

/** Mounted only while the Vault tab is focused: tabs stay mounted, and the flag must not leak to other tabs. */
const PreventCapture = () => {
  usePreventScreenCapture("finzz-vault");
  return null;
};

const VaultGate = () => {
  const { status } = useVault();
  const { theme } = useTheme();
  const focused = useIsFocused();

  let body: React.ReactNode;
  if (status === "loading") {
    body = (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  } else if (status !== "unlocked") {
    // Locking unmounts the stack, so no vault screen is reachable while locked.
    body = <VaultUnlockScreen />;
  } else {
    body = (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="VaultHome" component={VaultHomeScreen} />
        <Stack.Screen name="VaultEntry" component={VaultEntryScreen} />
        <Stack.Screen name="VaultEditEntry" component={VaultEditEntryScreen} />
        <Stack.Screen name="VaultSettings" component={VaultSettingsScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <>
      {focused ? <PreventCapture /> : null}
      {body}
    </>
  );
};

const VaultStackNavigator = () => (
  <VaultProvider>
    <VaultGate />
  </VaultProvider>
);

export default VaultStackNavigator;
