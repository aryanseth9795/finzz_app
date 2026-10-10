/**
 * Endpoints whose 401 means "wrong credentials", not "access token expired".
 * Refreshing on those signed the user out with a misleading "Your session
 * expired" message — e.g. after simply mistyping a password at login.
 */
const CREDENTIAL_ENDPOINTS = [
  "/users/login",
  "/users/register",
  "/users/send-otp",
  "/users/verify-otp",
  "/users/forgot-password",
  "/users/reset-password",
  "/users/change-password",
  "/users/refresh",
];

/** Whether a 401 response should trigger the access-token refresh flow. */
export const shouldRefreshOn401 = (url: string | undefined, hadAccessToken: boolean): boolean => {
  if (!url || !hadAccessToken) return false;
  const path = url.split("?")[0];
  return !CREDENTIAL_ENDPOINTS.some((p) => path.endsWith(p));
};
