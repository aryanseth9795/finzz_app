import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { BASE_URL } from "../constants/api";
import { tokenManager } from "../utils/tokenManager";

// Extend axios config to track retry
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Logout callback - will be set by the auth context
let onLogout: (() => void) | null = null;

export const setLogoutCallback = (callback: () => void) => {
  onLogout = callback;
};

// ========================
// Request Interceptor
// Attach access_token from SecureStore
// ========================
api.interceptors.request.use(
  async (config) => {
    const token = await tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ========================
// Response Interceptor
// Auto-refresh on 401 errors
// ========================
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig;

    // Don't retry for refresh endpoint itself or if already retried
    if (
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/users/refresh")
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      originalRequest._retry = true;

      try {
        const refreshToken = await tokenManager.getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token");

        // Call refresh with refresh token in Authorization header
        const response = await axios.post(
          `${BASE_URL}/users/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          },
        );

        const { access_token, refresh_token } = response.data;

        // Save new tokens
        await tokenManager.setAccessToken(access_token);
        await tokenManager.setRefreshToken(refresh_token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch {
        // Refresh failed — force logout
        await tokenManager.clearAll();
        onLogout?.();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
