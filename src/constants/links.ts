/**
 * Website origins, primary first. aryantechie.in expires Dec 2026, so the site
 * moves to aryanseth.in; the old host stays as a fallback until the new one is live.
 */
export const SITE_ORIGINS = [
  "https://finzz.aryanseth.in",
  "https://finzz.aryantechie.in",
] as const;
export const SITE_URL = SITE_ORIGINS[0];

export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";
export const DELETE_ACCOUNT_PATH = "/delete-account";

export const PRIVACY_URL = `${SITE_URL}${PRIVACY_PATH}`;
export const TERMS_URL = `${SITE_URL}${TERMS_PATH}`;
export const DELETE_ACCOUNT_URL = `${SITE_URL}${DELETE_ACCOUNT_PATH}`;
// Set before release (T-017): the public support address.
export const SUPPORT_EMAIL = "official.aryan9795@gmail.com";
