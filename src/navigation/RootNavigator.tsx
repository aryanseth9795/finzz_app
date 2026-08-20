import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { useAppSelector, useAppDispatch } from "../store";
import {
  setCredentials,
  setInitializing,
  logout as logoutAction,
} from "../store/slices/authSlice";
import { setLogoutCallback } from "../api/axios";
import { getProfileApi, refreshTokenApi } from "../api/authApi";
import { tokenManager } from "../utils/tokenManager";
import { cacheManager } from "../utils/cacheManager";
import { useNotifications } from "../hooks/useNotifications";
import { useAppUpdates } from "../hooks/useAppUpdates";
import { navigationRef } from "./navigationRef";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import EmailVerifyModal from "../components/EmailVerifyModal";

const RootNavigator = () => {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const { showErrorToast } = useToast();
  const dispatch = useAppDispatch();
  const { isAuthenticated, initializing, user } = useAppSelector(
    (state) => state.auth,
  );
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalDismissed, setEmailModalDismissed] = useState(false);

  useAppUpdates();
  useNotifications();

  /**
   * Central sign-out.
   *
   * Every location that acquired state at login is torn down here: secure
   * storage, the on-disk cache, and the in-memory Redux store (via the root
   * reducer's reset on `logout`). Previously only the tokens were cleared, so
   * the next account to sign in on the device saw the previous user's chats,
   * balances and ledger.
   */
  const signOut = useCallback(
    async (reason?: string) => {
      await tokenManager.clearAll();
      await cacheManager.clearAll();
      dispatch(logoutAction());
      if (reason) showErrorToast(reason);
    },
    [dispatch, showErrorToast],
  );

  useEffect(() => {
    setLogoutCallback((reason?: string) => {
      void signOut(reason);
    });
  }, [signOut]);

  /**
   * Restore the session on cold start.
   *
   * The previous version could hang on the splash screen for ever: with an
   * access token present but no cached user blob, neither the `.then` failure
   * branch nor a `success: false` response cleared `initializing`, so the app
   * sat on a spinner with no timeout, no error and no retry — and relaunching
   * reproduced it, because the same tokens were still there.
   *
   * `finally` guarantees the flag is cleared on every path.
   */
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const [accessToken, refreshToken, cachedUser] = await Promise.all([
          tokenManager.getAccessToken(),
          tokenManager.getRefreshToken(),
          tokenManager.getUserData(),
        ]);

        if (!accessToken && !refreshToken) return;

        // Show the cached user immediately so the app is usable offline.
        if (cachedUser) {
          try {
            const parsed = JSON.parse(cachedUser);
            if (!cancelled) dispatch(setCredentials(parsed));
          } catch {
            // Corrupt cache — fall through to the network path.
          }
        }

        if (!accessToken && refreshToken) {
          const response = await refreshTokenApi(refreshToken);
          await tokenManager.setAccessToken(response.data.access_token);
          await tokenManager.setRefreshToken(response.data.refresh_token);
        }

        const profile = await getProfileApi();
        if (cancelled) return;

        if (profile.data?.success && profile.data.user) {
          dispatch(setCredentials(profile.data.user));
          await tokenManager.setUserData(JSON.stringify(profile.data.user));
        }
      } catch {
        if (cancelled) return;
        // Only sign out if the credentials are genuinely gone. A network
        // failure with a cached user must leave them signed in and offline,
        // not evict them.
        const stillHasToken = await tokenManager.getAccessToken();
        const hasCachedUser = await tokenManager.getUserData();
        if (!stillHasToken && !hasCachedUser) {
          await signOut();
        }
      } finally {
        if (!cancelled) dispatch(setInitializing(false));
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [dispatch, signOut]);

  /**
   * Email verification prompt.
   *
   * Gated on `emailModalDismissed` so that dismissing it and then pulling to
   * refresh does not immediately re-open it: `setCredentials` fires on every
   * profile refresh, and the effect depends on the user object.
   */
  useEffect(() => {
    if (!isAuthenticated || !user || user.emailVerified || emailModalDismissed) {
      return;
    }
    const timer = setTimeout(() => setShowEmailModal(true), 1200);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user?.emailVerified, emailModalDismissed, isAuthenticated]);

  // Reset the dismissal when the account changes, so a new user is prompted.
  useEffect(() => {
    setEmailModalDismissed(false);
  }, [user?._id]);

  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
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
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Loading Finzz"
        />
        <Text style={[styles.splashText, { color: colors.textTertiary }]}>
          Finzz
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
      <EmailVerifyModal
        visible={showEmailModal && isAuthenticated}
        onDismiss={() => {
          setShowEmailModal(false);
          setEmailModalDismissed(true);
        }}
      />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  splashText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 1,
  },
});

export default RootNavigator;
