import React, { useEffect, useState } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAppSelector, useAppDispatch } from "../store";
import { setCredentials, setInitializing } from "../store/slices/authSlice";
import { setLogoutCallback } from "../api/axios";
import { getProfileApi } from "../api/authApi";
import { tokenManager } from "../utils/tokenManager";
import { logout as logoutAction } from "../store/slices/authSlice";
import { useNotifications } from "../hooks/useNotifications";
import { useAppUpdates } from "../hooks/useAppUpdates";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";

const RootNavigator = () => {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const dispatch = useAppDispatch();
  const { isAuthenticated, initializing } = useAppSelector(
    (state) => state.auth,
  );

  // Check for OTA updates on app launch
  useAppUpdates();

  // Register for push notifications when authenticated
  useNotifications();

  // Set logout callback for axios interceptor
  useEffect(() => {
    setLogoutCallback(() => {
      dispatch(logoutAction());
    });
  }, [dispatch]);

  // Check stored tokens on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const accessToken = await tokenManager.getAccessToken();
        const userDataStr = await tokenManager.getUserData();

        if (accessToken && userDataStr) {
          const userData = JSON.parse(userDataStr);
          dispatch(setCredentials(userData));

          // Background refresh of profile
          getProfileApi()
            .then(async (res) => {
              if (res.data.success && res.data.user) {
                dispatch(setCredentials(res.data.user)); // Update Redux
                await tokenManager.setUserData(JSON.stringify(res.data.user)); // Update Cache
              }
            })
            .catch((err) => {
              console.log("Background profile fetch failed", err);
            });
        } else {
          dispatch(setInitializing(false));
        }
      } catch {
        dispatch(setInitializing(false));
      }
    };
    checkAuth();
  }, [dispatch]);

  // Custom navigation theme
  const navTheme = React.useMemo(() => {
    return isDark
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.headerBackground,
            text: colors.text,
            border: colors.border,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.headerBackground,
            text: colors.text,
            border: colors.border,
          },
        };
  }, [isDark, colors]);

  if (initializing) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default RootNavigator;
