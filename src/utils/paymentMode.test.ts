import { describe, expect, it } from "vitest";
import type { IExpense, PaymentMethod, PaymentMode } from "../types";
import {
  PAYMENT_METHODS,
  PAYMENT_MODES,
  editPaymentPayload,
  nextPaymentChoice,
  paymentChoiceOf,
  paymentLabel,
  paymentPayload,
  type PaymentChoice,
} from "./paymentMode";

type PaymentFields = Pick<IExpense, "paymentMode" | "paymentMethod">;

// A newer server may send values this build does not know yet.
const unknownRow = (mode: string, method?: string): PaymentFields =>
  ({ paymentMode: mode, paymentMethod: method }) as unknown as PaymentFields;

const choice = (
  mode: PaymentMode | null,
  method: PaymentMethod | null = null
): PaymentChoice => ({ mode, method });

const NONE = choice(null);

const tapMode = (current: PaymentChoice, value: PaymentMode) =>
  nextPaymentChoice(current, { kind: "mode", value });
const tapMethod = (current: PaymentChoice, value: PaymentMethod) =>
  nextPaymentChoice(current, { kind: "method", value });

describe("PAYMENT_MODES / PAYMENT_METHODS", () => {
  it("lists Cash then Online", () => {
    expect(PAYMENT_MODES).toEqual([
      { value: "cash", label: "Cash" },
      { value: "online", label: "Online" },
    ]);
  });

  it("lists the online methods in the agreed order", () => {
    expect(PAYMENT_METHODS).toEqual([
      { value: "upi", label: "UPI" },
      { value: "card", label: "Card" },
      { value: "netbanking", label: "Net banking" },
      { value: "wallet", label: "Wallet" },
      { value: "other", label: "Other" },
    ]);
  });
});

describe("paymentChoiceOf", () => {
  it("is empty for no expense (a new one)", () => {
    expect(paymentChoiceOf()).toEqual(NONE);
    expect(paymentChoiceOf(null)).toEqual(NONE);
  });

  it("is empty for an old row with no payment fields", () => {
    expect(paymentChoiceOf({})).toEqual(NONE);
  });

  it("keeps cash", () => {
    expect(paymentChoiceOf({ paymentMode: "cash" })).toEqual(choice("cash"));
  });

  it("keeps online with and without a method", () => {
    expect(paymentChoiceOf({ paymentMode: "online" })).toEqual(
      choice("online")
    );
    expect(
      paymentChoiceOf({ paymentMode: "online", paymentMethod: "upi" })
    ).toEqual(choice("online", "upi"));
  });

  it("drops a method when the mode is not online", () => {
    expect(
      paymentChoiceOf({ paymentMode: "cash", paymentMethod: "card" })
    ).toEqual(choice("cash"));
    expect(paymentChoiceOf({ paymentMethod: "card" })).toEqual(NONE);
  });

  it("turns unknown values into null", () => {
    expect(paymentChoiceOf(unknownRow("cheque"))).toEqual(NONE);
    expect(paymentChoiceOf(unknownRow("cheque", "upi"))).toEqual(NONE);
    expect(paymentChoiceOf(unknownRow("online", "crypto"))).toEqual(
      choice("online")
    );
  });
});

describe("nextPaymentChoice", () => {
  it("selects a mode from nothing", () => {
    expect(tapMode(NONE, "cash")).toEqual(choice("cash"));
    expect(tapMode(NONE, "online")).toEqual(choice("online"));
  });

  it("toggles the selected mode off, clearing the method too", () => {
    expect(tapMode(choice("cash"), "cash")).toEqual(NONE);
    expect(tapMode(choice("online", "upi"), "online")).toEqual(NONE);
  });

  it("cash -> online starts with no method", () => {
    expect(tapMode(choice("cash"), "online")).toEqual(choice("online"));
  });

  it("online + method -> cash clears the method", () => {
    expect(tapMode(choice("online", "card"), "cash")).toEqual(choice("cash"));
  });

  it("cash -> online -> pick method -> cash -> online has no method left", () => {
    let c = tapMode(NONE, "cash");
    c = tapMode(c, "online");
    c = tapMethod(c, "wallet");
    expect(c).toEqual(choice("online", "wallet"));
    c = tapMode(c, "cash");
    expect(c).toEqual(choice("cash"));
    c = tapMode(c, "online");
    expect(c).toEqual(choice("online"));
  });

  it("selects a method while online", () => {
    expect(tapMethod(choice("online"), "upi")).toEqual(choice("online", "upi"));
  });

  it("switches to another method while online", () => {
    expect(tapMethod(choice("online", "upi"), "netbanking")).toEqual(
      choice("online", "netbanking")
    );
  });

  it("tapping the selected method clears it", () => {
    expect(tapMethod(choice("online", "upi"), "upi")).toEqual(
      choice("online")
    );
  });

  it("ignores a method tap while cash or nothing is selected", () => {
    const cash = choice("cash");
    expect(tapMethod(cash, "upi")).toEqual(cash);
    expect(tapMethod(NONE, "card")).toEqual(NONE);
  });

  it("does not mutate the current choice", () => {
    const current = choice("online", "upi");
    tapMode(current, "cash");
    tapMethod(current, "card");
    expect(current).toEqual(choice("online", "upi"));
  });
});

describe("paymentLabel", () => {
  it("shows each method's label when online", () => {
    expect(paymentLabel({ paymentMode: "online", paymentMethod: "upi" })).toBe(
      "UPI"
    );
    expect(
      paymentLabel({ paymentMode: "online", paymentMethod: "card" })
    ).toBe("Card");
    expect(
      paymentLabel({ paymentMode: "online", paymentMethod: "netbanking" })
    ).toBe("Net banking");
    expect(
      paymentLabel({ paymentMode: "online", paymentMethod: "wallet" })
    ).toBe("Wallet");
    expect(
      paymentLabel({ paymentMode: "online", paymentMethod: "other" })
    ).toBe("Other");
  });

  it('shows "Online" when online with no method', () => {
    expect(paymentLabel({ paymentMode: "online" })).toBe("Online");
  });

  it('shows "Cash" for cash, ignoring a stray method', () => {
    expect(paymentLabel({ paymentMode: "cash" })).toBe("Cash");
    expect(paymentLabel({ paymentMode: "cash", paymentMethod: "upi" })).toBe(
      "Cash"
    );
  });

  it("is null for an old row with no payment fields", () => {
    expect(paymentLabel({})).toBeNull();
  });

  it("is null for a method with no mode", () => {
    expect(paymentLabel({ paymentMethod: "upi" })).toBeNull();
  });

  it("treats unknown values as absent", () => {
    expect(paymentLabel(unknownRow("online", "crypto"))).toBe("Online");
    expect(paymentLabel(unknownRow("cheque"))).toBeNull();
    expect(paymentLabel(unknownRow("cheque", "upi"))).toBeNull();
  });
});

describe("paymentPayload (add)", () => {
  it("is empty when no mode is chosen", () => {
    expect(paymentPayload(NONE, false)).toEqual({});
  });

  it("sends cash alone", () => {
    expect(paymentPayload(choice("cash"), false)).toEqual({
      paymentMode: "cash",
    });
  });

  it("sends online alone when no method is chosen", () => {
    expect(paymentPayload(choice("online"), false)).toEqual({
      paymentMode: "online",
    });
  });

  it("sends online with its method", () => {
    expect(paymentPayload(choice("online", "upi"), false)).toEqual({
      paymentMode: "online",
      paymentMethod: "upi",
    });
  });

  it("never sends a method without online, even from a bad choice", () => {
    expect(paymentPayload(choice("cash", "upi"), false)).toEqual({
      paymentMode: "cash",
    });
    expect(paymentPayload(choice(null, "upi"), false)).toEqual({});
  });

  it("never contains null and has no undefined keys", () => {
    const all: PaymentChoice[] = [
      NONE,
      choice("cash"),
      choice("online"),
      choice("online", "card"),
      choice("cash", "card"),
      choice(null, "card"),
    ];
    for (const c of all) {
      const body = paymentPayload(c, false) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        expect(value, key).not.toBeNull();
        expect(value, key).not.toBeUndefined();
      }
      if ("paymentMethod" in body) expect(body.paymentMode).toBe("online");
    }
  });
});

describe("paymentPayload (edit)", () => {
  it("sends both keys as null when nothing is chosen", () => {
    const body = paymentPayload(NONE, true);
    expect(body).toEqual({ paymentMode: null, paymentMethod: null });
    expect(Object.keys(body).sort()).toEqual(["paymentMethod", "paymentMode"]);
  });

  it("sends cash with a null method", () => {
    expect(paymentPayload(choice("cash"), true)).toEqual({
      paymentMode: "cash",
      paymentMethod: null,
    });
  });

  it("sends online with a null method when none is chosen", () => {
    expect(paymentPayload(choice("online"), true)).toEqual({
      paymentMode: "online",
      paymentMethod: null,
    });
  });

  it("sends online with its method", () => {
    expect(paymentPayload(choice("online", "wallet"), true)).toEqual({
      paymentMode: "online",
      paymentMethod: "wallet",
    });
  });

  it("nulls a method that is not under online", () => {
    expect(paymentPayload(choice("cash", "upi"), true)).toEqual({
      paymentMode: "cash",
      paymentMethod: null,
    });
    expect(paymentPayload(choice(null, "upi"), true)).toEqual({
      paymentMode: null,
      paymentMethod: null,
    });
  });

  it("spreads into a request body", () => {
    const body: EditBody = {
      amount: 100,
      ...paymentPayload(choice("cash"), true),
    };
    expect(body).toEqual({
      amount: 100,
      paymentMode: "cash",
      paymentMethod: null,
    });
  });
});

describe("editPaymentPayload", () => {
  it("is empty when the choice is unchanged", () => {
    expect(
      editPaymentPayload(choice("online", "upi"), choice("online", "upi"))
    ).toEqual({});
    expect(editPaymentPayload(choice("cash"), choice("cash"))).toEqual({});
  });

  it("is empty when both are unchanged nulls", () => {
    expect(editPaymentPayload(NONE, choice(null, null))).toEqual({});
  });

  it("sends both keys when the mode changed", () => {
    expect(editPaymentPayload(choice("cash"), choice("online"))).toEqual({
      paymentMode: "online",
      paymentMethod: null,
    });
    expect(editPaymentPayload(NONE, choice("cash"))).toEqual({
      paymentMode: "cash",
      paymentMethod: null,
    });
  });

  it("sends both keys when the method changed", () => {
    expect(
      editPaymentPayload(choice("online", "upi"), choice("online", "card"))
    ).toEqual({ paymentMode: "online", paymentMethod: "card" });
    expect(
      editPaymentPayload(choice("online"), choice("online", "wallet"))
    ).toEqual({ paymentMode: "online", paymentMethod: "wallet" });
    expect(
      editPaymentPayload(choice("online", "upi"), choice("online"))
    ).toEqual({ paymentMode: "online", paymentMethod: null });
  });

  it("sends both nulls when the choice was cleared", () => {
    expect(editPaymentPayload(choice("online", "upi"), NONE)).toEqual({
      paymentMode: null,
      paymentMethod: null,
    });
    expect(editPaymentPayload(choice("cash"), NONE)).toEqual({
      paymentMode: null,
      paymentMethod: null,
    });
  });

  it("keeps an unknown stored method when the chips are left alone", () => {
    const initial = paymentChoiceOf({
      paymentMode: "online",
      paymentMethod: "emi" as never,
    });
    const current = paymentChoiceOf({
      paymentMode: "online",
      paymentMethod: "emi" as never,
    });
    expect(editPaymentPayload(initial, current)).toEqual({});
  });

  it("spreads into an edit body", () => {
    const same: EditBody = {
      amount: 5,
      ...editPaymentPayload(choice("cash"), choice("cash")),
    };
    const changed: EditBody = {
      amount: 5,
      ...editPaymentPayload(choice("cash"), choice("online", "upi")),
    };
    expect(same).toEqual({ amount: 5 });
    expect(changed).toEqual({
      amount: 5,
      paymentMode: "online",
      paymentMethod: "upi",
    });
  });
});

// Request-body shapes from the server contract; the assignments below are
// checked by `tsc`, so the return types must spread into them.
interface AddBody {
  amount: number;
  paymentMode?: PaymentMode;
  paymentMethod?: PaymentMethod;
}
interface EditBody {
  amount?: number;
  paymentMode?: PaymentMode | null;
  paymentMethod?: PaymentMethod | null;
}

describe("paymentPayload typing", () => {
  it("add result spreads into an add body", () => {
    const empty: AddBody = { amount: 1, ...paymentPayload(NONE, false) };
    const online: AddBody = {
      amount: 1,
      ...paymentPayload(choice("online", "upi"), false),
    };
    expect(empty).toEqual({ amount: 1 });
    expect(online).toEqual({
      amount: 1,
      paymentMode: "online",
      paymentMethod: "upi",
    });
  });

  it("a runtime isEditing flag still spreads into an edit body", () => {
    const isEditing = Math.random() < 2; // a boolean, not a literal
    const body: EditBody = { ...paymentPayload(choice("cash"), isEditing) };
    expect(body).toEqual({ paymentMode: "cash", paymentMethod: null });
  });
});
