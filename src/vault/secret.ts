import type { SecretType } from "./crypto";

/** PIN: 4–6 digits. Password: at least 4 characters, no surrounding spaces. */
export const validateSecret = (type: SecretType, value: string): string | null => {
  if (type === "pin") {
    return /^\d{4,6}$/.test(value) ? null : "PIN must be 4–6 digits";
  }
  if (value.length < 4) return "Password must be at least 4 characters";
  if (value !== value.trim()) return "Password can't start or end with a space";
  if (value.length > 128) return "Password must be 128 characters or fewer";
  return null;
};
