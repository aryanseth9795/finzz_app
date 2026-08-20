/**
 * Money parsing and formatting.
 *
 * THE BUG THIS FIXES
 * Three screens validated an amount with:
 *
 *     if (!amount || parseFloat(amount) <= 0) { …reject… }
 *     if (parseFloat(amount) >= 10000000)     { …reject… }
 *
 * For `amount = "abc"`: the string is truthy, `parseFloat` yields NaN, and
 * BOTH `NaN <= 0` and `NaN >= 10000000` are false. Validation passed, and
 * `JSON.stringify({ amount: NaN })` serialises to `{"amount":null}` — which
 * reached a server route that (at the time) had no schema at all.
 *
 * `AddEditTxScreen` got this right with an explicit `isNaN` check, which is
 * the tell: the correct check was known and simply not applied to the other
 * two screens. Centralising it means there is one place to be right.
 */

export const MAX_AMOUNT = 10_000_000;

export type ParsedAmount =
  | { ok: true; value: number }
  | { ok: false; message: string };

/**
 * Parse a user-entered amount.
 *
 * Rejects NaN and Infinity explicitly rather than relying on comparisons,
 * because every comparison against NaN is false — which is exactly how the
 * original guards were bypassed.
 */
export const parseAmount = (input: string): ParsedAmount => {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Please enter an amount" };
  }

  // Reject anything that is not a plain decimal number before parsing.
  // `parseFloat("12abc")` returns 12, silently accepting typos.
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return { ok: false, message: "Amount can have at most 2 decimal places" };
    }
    return { ok: false, message: "Enter a valid amount, e.g. 250 or 250.50" };
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return { ok: false, message: "Enter a valid amount" };
  }
  if (value <= 0) {
    return { ok: false, message: "Amount must be greater than 0" };
  }
  if (value >= MAX_AMOUNT) {
    return { ok: false, message: "Amount must be less than ₹1 crore" };
  }

  // Round to paise so accumulated fractions cannot drift a ledger total.
  return { ok: true, value: Math.round(value * 100) / 100 };
};

/** Indian-locale currency for display. */
export const formatCurrency = (amount: number | null | undefined): string => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "₹0";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

/** Numeric-only, for compact contexts that render the symbol separately. */
export const formatNumber = (amount: number | null | undefined): string => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};
