import type { IExpense, PaymentMethod, PaymentMode } from "../types";

/**
 * Payment mode on an expense (optional): Cash or Online, and for Online an
 * optional method. Pure helpers shared by the form chips, the list row and
 * the save request. The server stores the method only under Online.
 */

export const PAYMENT_MODES: readonly { value: PaymentMode; label: string }[] =
  [
    { value: "cash", label: "Cash" },
    { value: "online", label: "Online" },
  ];

export const PAYMENT_METHODS: readonly {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "netbanking", label: "Net banking" },
  { value: "wallet", label: "Wallet" },
  { value: "other", label: "Other" },
];

/** What the form's chips currently show. */
export interface PaymentChoice {
  mode: PaymentMode | null;
  method: PaymentMethod | null;
}

export type PaymentTap =
  | { kind: "mode"; value: PaymentMode }
  | { kind: "method"; value: PaymentMethod };

type PaymentFields = Pick<IExpense, "paymentMode" | "paymentMethod">;

/** Add: unset fields are left out; a method only ever goes with online. */
export type AddPaymentFields =
  | Record<string, never>
  | { paymentMode: PaymentMode }
  | { paymentMode: "online"; paymentMethod: PaymentMethod };

/** Edit: both keys always present; `null` clears on the server. */
export interface EditPaymentFields {
  paymentMode: PaymentMode | null;
  paymentMethod: PaymentMethod | null;
}

const modeLabel = (value: unknown) =>
  PAYMENT_MODES.find((m) => m.value === value)?.label ?? null;
const methodLabel = (value: unknown) =>
  PAYMENT_METHODS.find((m) => m.value === value)?.label ?? null;

const knownMode = (value: unknown): PaymentMode | null =>
  PAYMENT_MODES.find((m) => m.value === value)?.value ?? null;
const knownMethod = (value: unknown): PaymentMethod | null =>
  PAYMENT_METHODS.find((m) => m.value === value)?.value ?? null;

/**
 * The chips to prefill the edit form with. Unknown values (from a newer
 * server) become null, and a method is kept only under online.
 */
export function paymentChoiceOf(
  expense?: PaymentFields | null
): PaymentChoice {
  const mode = knownMode(expense?.paymentMode);
  const method = mode === "online" ? knownMethod(expense?.paymentMethod) : null;
  return { mode, method };
}

/** The chip rules: tap a selected chip to clear it; leaving online clears the method. */
export function nextPaymentChoice(
  current: PaymentChoice,
  tap: PaymentTap
): PaymentChoice {
  if (tap.kind === "mode") {
    if (current.mode === tap.value) return { mode: null, method: null };
    // Switching modes always starts without a method (cash -> online too).
    return { mode: tap.value, method: null };
  }
  if (current.mode !== "online") return current;
  return {
    mode: "online",
    method: current.method === tap.value ? null : tap.value,
  };
}

/**
 * The list row's payment text: the method when online and known, else the
 * mode ("Cash" / "Online"), else null (old rows, unknown values).
 */
export function paymentLabel(expense: PaymentFields): string | null {
  const mode = knownMode(expense.paymentMode);
  if (!mode) return null;
  if (mode === "online") {
    const method = methodLabel(expense.paymentMethod);
    if (method) return method;
  }
  return modeLabel(mode);
}

/** The payment part of the save request, ready to spread into the body. */
export function paymentPayload(
  choice: PaymentChoice,
  isEditing: true
): EditPaymentFields;
export function paymentPayload(
  choice: PaymentChoice,
  isEditing: false
): AddPaymentFields;
export function paymentPayload(
  choice: PaymentChoice,
  isEditing: boolean
): AddPaymentFields | EditPaymentFields;
export function paymentPayload(
  choice: PaymentChoice,
  isEditing: boolean
): AddPaymentFields | EditPaymentFields {
  const { mode, method } = choice;
  if (isEditing) {
    return {
      paymentMode: mode ?? null,
      paymentMethod: mode === "online" ? method ?? null : null,
    };
  }
  if (!mode) return {};
  if (mode === "online" && method) {
    return { paymentMode: "online", paymentMethod: method };
  }
  return { paymentMode: mode };
}

/**
 * The payment part of an edit request: `{}` when the chips still show what
 * they showed when the form opened (the server keeps a missing key), else
 * both keys as `paymentPayload(current, true)` sends them.
 *
 * `initial` is `paymentChoiceOf(expense)` taken when the form opened, so a
 * value this app doesn't know (from a newer server) survives an edit that
 * leaves the chips alone instead of being sent back as null.
 */
export function editPaymentPayload(
  initial: PaymentChoice,
  current: PaymentChoice
): EditPaymentFields | Record<string, never> {
  if (initial.mode === current.mode && initial.method === current.method) {
    return {};
  }
  return paymentPayload(current, true);
}
