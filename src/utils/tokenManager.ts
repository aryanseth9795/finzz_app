import * as SecureStore from "expo-secure-store";

const TOKEN_KEYS = {
  ACCESS: "finzz_access_token",
  REFRESH: "finzz_refresh_token",
  USER: "finzz_user_data",
} as const;

export const tokenManager = {
  // Access Token
  getAccessToken: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
    } catch {
      return null;
    }
  },

  setAccessToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, token);
  },

  // Refresh Token
  getRefreshToken: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);
    } catch {
      return null;
    }
  },

  setRefreshToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, token);
  },

  // User Data (cached in SecureStore for fast startup)
  getUserData: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEYS.USER);
    } catch {
      return null;
    }
  },

  setUserData: async (userData: string): Promise<void> => {
    await SecureStore.setItemAsync(TOKEN_KEYS.USER, userData);
  },

  // Save all tokens + user after login/register
  saveAuthData: async (
    accessToken: string,
    refreshToken: string,
    userData: object,
  ): Promise<void> => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, accessToken),
      SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refreshToken),
      SecureStore.setItemAsync(TOKEN_KEYS.USER, JSON.stringify(userData)),
    ]);
  },

  // Clear all on logout
  clearAll: async (): Promise<void> => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS),
      SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH),
      SecureStore.deleteItemAsync(TOKEN_KEYS.USER),
    ]);
  },
};
