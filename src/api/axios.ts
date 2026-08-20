import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { BASE_URL, REQUEST_TIMEOUT_MS } from "../constants/api";
import { tokenManager } from "../utils/tokenManager";

// Extend axios config to track retry
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Logout callback - will be set by the auth context
let onLogout: ((reason?: string) => void) | null = null;

export const setLogoutCallback = (callback: (reason?: string) => void) => {
  onLogout = callback;
};

// ========================
// Refresh queue management
// Prevents multiple concurrent refresh calls
// ========================
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
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
// ========================
api.interceptors.request.use(
  async (config) => {
    const token = await tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    /**
     * Tell the server which calendar the user is in.
     *
     * Ledger months are a fact about the USER's calendar, not about an
     * instant. Without this the server fell back to its own clock, and for a
     * user at UTC+5:30 an expense dated the 1st filed into the previous month
     * — it vanished from the month they entered it under.
     *
     * `getTimezoneOffset()` returns minutes to SUBTRACT from local to reach
     * UTC, so it is negated here to mean "minutes to add to UTC to reach
     * local" — +330 for IST. The server bounds and defaults it, so an older
     * build that omits it still works.
     */
    const tzOffsetMinutes = -new Date().getTimezoneOffset();

    if (config.method === "get") {
      config.params = { ...(config.params ?? {}), tzOffsetMinutes };
    } else if (config.data && typeof config.data === "object" && !(config.data instanceof FormData)) {
      config.data = { ...config.data, tzOffsetMinutes };
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
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenManager.getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token");

        // Bare axios, not `api`: this must not re-enter the interceptor.
        const response = await axios.post(
          `${BASE_URL}/users/refresh`,
          {},
          {
            headers: { Authorization: `Bearer ${refreshToken}` },
            timeout: REQUEST_TIMEOUT_MS,
          },
        );

        const { access_token, refresh_token } = response.data;

        // The server now ROTATES refresh tokens: the presented one is consumed
        // and must be replaced, or the next refresh will be rejected.
        await tokenManager.setAccessToken(access_token);
        await tokenManager.setRefreshToken(refresh_token);

        processQueue(null, access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenManager.clearAll();
        // Tell the user why they were signed out instead of silently
        // returning them to the login screen.
        onLogout?.("Your session expired. Please sign in again.");
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Human-readable message for a failed request.
 *
 * Every screen hand-rolled `error?.response?.data?.message || "Something went
 * wrong"`, which meant a timeout, an offline device and a server fault all
 * produced the same unhelpful string. Distinguishing them is what lets the UI
 * say "you appear to be offline" rather than "error".
 */
export const describeError = (error: unknown): string => {
  const axiosError = error as AxiosError<{ message?: string }>;

  if (axiosError?.response) {
    return (
      axiosError.response.data?.message ??
      `Request failed (${axiosError.response.status})`
    );
  }
  if (axiosError?.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }
  if (axiosError?.request) {
    return "No connection. Check your internet and try again.";
  }
  return "Something went wrong. Please try again.";
};

/** True when the failure was transport-level rather than a server response. */
export const isOffline = (error: unknown): boolean => {
  const axiosError = error as AxiosError;
  return Boolean(!axiosError?.response && axiosError?.request);
};

export default api;
