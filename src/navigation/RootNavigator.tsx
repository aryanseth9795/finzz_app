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
import { BASE_URL } from "../constants/api";
import { logout as logoutAction } from "../store/slices/authSlice";
import { useNotifications } from "../hooks/useNotifications";
import { useAppUpdates } from "../hooks/useAppUpdates";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import EmailVerifyModal from "../components/EmailVerifyModal";

const RootNavigator = () => {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const dispatch = useAppDispatch();
  const { isAuthenticated, initializing, user } = useAppSelector(
    (state) => state.auth,
  );
  const [showEmailModal, setShowEmailModal] = useState(false);

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
        const refreshTokenVal = await tokenManager.getRefreshToken();
        const userDataStr = await tokenManager.getUserData();

        // No tokens at all — not logged in
        if (!accessToken && !refreshTokenVal) {
          dispatch(setInitializing(false));
          return;
        }

        // Show cached user immediately if available
        if (userDataStr) {
          try {
            const userData = JSON.parse(userDataStr);
            dispatch(setCredentials(userData));
          } catch {
            // corrupt cache — ignore
          }
        }

        // If we have an access token, try fetching profile.
        // If it's expired, the axios interceptor will auto-refresh.
        // If no access token but we have a refresh token, manually refresh first.
        if (!accessToken && refreshTokenVal) {
          try {
            const { default: axios } = await import("axios");
            const response = await axios.post(
              `${BASE_URL}/users/refresh`,
              {},
              {
                headers: { Authorization: `Bearer ${refreshTokenVal}` },
                timeout: 15000,
              },
            );
            const { access_token, refresh_token } = response.data;
            await tokenManager.setAccessToken(access_token);
            await tokenManager.setRefreshToken(refresh_token);
          } catch {
            // Refresh failed — force logout
            await tokenManager.clearAll();
            dispatch(setInitializing(false));
            return;
          }
        }

        // Now fetch fresh profile (interceptor handles 401 if needed)
        getProfileApi()
          .then(async (res) => {
            if (res.data.success && res.data.user) {
              dispatch(setCredentials(res.data.user));
              await tokenManager.setUserData(JSON.stringify(res.data.user));
            }
          })
          .catch(async () => {
            // If profile fetch fails even after refresh, logout
            const stillHasToken = await tokenManager.getAccessToken();
            if (!stillHasToken) {
              dispatch(logoutAction());
            }
          });
      } catch {
        dispatch(setInitializing(false));
      }
    };
    checkAuth();
  }, [dispatch]);

  // Show email verification modal when user is authenticated but has no verified email
  useEffect(() => {
    if (isAuthenticated && user && !user.emailVerified) {
      // Small delay so the main screen renders first
      const timer = setTimeout(() => setShowEmailModal(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user?.emailVerified]);

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
      <EmailVerifyModal
        visible={showEmailModal && isAuthenticated}
        onDismiss={() => setShowEmailModal(false)}
      />
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
