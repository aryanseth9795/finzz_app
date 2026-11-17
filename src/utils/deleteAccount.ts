export const DELETE_CONFIRM_WORD = "DELETE";

/** Both a password and the typed confirm word are required. */
export const canSubmitDeletion = (password: string, typed: string): boolean =>
  password.length > 0 && typed.trim().toUpperCase() === DELETE_CONFIRM_WORD;

/**
 * User-facing text for a failed delete-account call. A wrong password is 400;
 * 401 only means the session expired (the axios interceptor refreshes first).
 */
export const deletionErrorMessage = (
  status?: number,
  serverMessage?: string,
): string => {
  if (status === 400) return "That password isn't right.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 429)
    return "Too many attempts. Please wait a few minutes and try again.";
  if (status === undefined)
    return "Couldn't reach Finzz. Check your connection and try again.";
  return serverMessage || "Something went wrong. Your account was not deleted.";
};
