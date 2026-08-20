/**
 * Phone number normalisation.
 *
 * THE BUG THIS FIXES
 * The login placeholder read `+91 98765 43210`, validation was
 * `phone.trim().length < 10` — length only — and the value was sent verbatim
 * to a server doing an exact `User.findOne({ phone })`.
 *
 * So a user who typed their number the way the placeholder showed it could not
 * log in, and the error they saw was a generic "Login failed". Worse, a user
 * who REGISTERED with spaces created an account no friend could ever find by
 * searching their real number, because the phone search is also exact-match.
 *
 * There was no canonical format anywhere in the client. There is now exactly
 * one, applied at every entry point: registration, login and friend search.
 */

const DEFAULT_COUNTRY_CODE = "91"; // India

/**
 * Convert user input to E.164 (`+919876543210`), or null if it cannot be.
 *
 * Accepts the shapes people actually type: with spaces, dashes, brackets, a
 * leading `+`, a leading `0`, or a bare 10-digit number.
 */
export const normalizePhone = (input: string): string | null => {
  if (!input) return null;

  const hadPlus = input.trim().startsWith("+");
  let digits = input.replace(/\D/g, "");

  if (!digits) return null;

  if (hadPlus) {
    // Already international; trust the country code the user supplied.
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  }

  // Domestic trunk prefix: 09876543210 → 9876543210
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Country code typed without a plus: 919876543210
  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  // Bare national number.
  if (digits.length === 10) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return null;
};

/** Validate and explain, for use directly in a form. */
export const validatePhone = (
  input: string,
): { ok: true; value: string } | { ok: false; message: string } => {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Phone number is required" };
  }
  const normalized = normalizePhone(trimmed);
  if (!normalized) {
    return {
      ok: false,
      message: "Enter a valid 10-digit mobile number",
    };
  }
  return { ok: true, value: normalized };
};

/** Readable form for display: +91 98765 43210 */
export const formatPhone = (phone: string | undefined | null): string => {
  if (!phone) return "";
  const match = /^\+(\d{1,3})(\d{5})(\d{5})$/.exec(phone);
  if (!match) return phone;
  return `+${match[1]} ${match[2]} ${match[3]}`;
};
