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
  timeout: 15000,
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
// Refresh queue management
// Prevents multiple concurrent refresh calls
// ========================
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
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
// Auto-refresh on 401 errors with queuing
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
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenManager.getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token");

        // Call refresh endpoint with refresh token
        const response = await axios.post(
          `${BASE_URL}/users/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
            timeout: 15000,
          },
        );

        const { access_token, refresh_token } = response.data;

        // Save new tokens
        await tokenManager.setAccessToken(access_token);
        await tokenManager.setRefreshToken(refresh_token);

        // Unblock queued requests
        processQueue(null, access_token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — force logout and reject all queued
        processQueue(refreshError, null);
        await tokenManager.clearAll();
        onLogout?.();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
