import { describe, it, expect } from "vitest";
import { parseAmount, formatCurrency, MAX_AMOUNT } from "./money";
import { normalizePhone, validatePhone, formatPhone } from "./phone";
import { refId, isRefTo, refName, compact, otherMember } from "./entities";
import {
  toApiDate,
  fromApiDate,
  pickerMinimumDate,
  pickerMaximumDate,
  startOfCurrentMonth,
} from "./dates";

/**
 * Tests are named after the finding IDs from the Phase 2 audit, so a failure
 * points straight at the entry explaining what broke and why.
 */

describe("APP-011 — the NaN hole in amount validation", () => {
  it('rejects "abc", which the original guard let through', () => {
    // Original: `if (!amount || parseFloat(amount) <= 0) reject`
    // "abc" is truthy; parseFloat → NaN; NaN <= 0 is FALSE; NaN >= MAX is
    // FALSE. Both guards passed and `{"amount":null}` went to the server.
    expect(parseFloat("abc") <= 0).toBe(false); // the bug, demonstrated
    expect(parseFloat("abc") >= 10000000).toBe(false);

    const result = parseAmount("abc");
    expect(result.ok).toBe(false);
  });

  it("rejects every non-numeric shape", () => {
    for (const input of ["", "   ", "abc", "12abc", "1.2.3", "-", "+", "NaN", "Infinity", "1e5"]) {
      expect(parseAmount(input).ok, `expected "${input}" to be rejected`).toBe(false);
    }
  });

  it("rejects zero, negatives and amounts at or above the cap", () => {
    expect(parseAmount("0").ok).toBe(false);
    expect(parseAmount("-5").ok).toBe(false);
    expect(parseAmount(String(MAX_AMOUNT)).ok).toBe(false);
  });

  it("accepts valid amounts and rounds to paise", () => {
    expect(parseAmount("250")).toEqual({ ok: true, value: 250 });
    expect(parseAmount("250.50")).toEqual({ ok: true, value: 250.5 });
    expect(parseAmount("  99.99  ")).toEqual({ ok: true, value: 99.99 });
  });

  it("rejects more than two decimal places rather than silently truncating", () => {
    const result = parseAmount("10.005");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/2 decimal/);
  });

  it("formats currency without crashing on bad input", () => {
    expect(formatCurrency(1234.5)).toContain("1,234.5");
    expect(formatCurrency(NaN)).toBe("₹0");
    expect(formatCurrency(null)).toBe("₹0");
    expect(formatCurrency(undefined)).toBe("₹0");
  });
});

describe("APP-028 — phone normalisation", () => {
  it("accepts the exact format the old placeholder taught", () => {
    // The login placeholder read "+91 98765 43210", validation was a length
    // check, and the raw string went to a server doing an exact match — so a
    // user who typed what the placeholder showed simply could not log in.
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });

  it("normalises every shape people actually type", () => {
    const expected = "+919876543210";
    for (const input of [
      "9876543210",
      "09876543210",
      "919876543210",
      "+919876543210",
      "98765 43210",
      "98765-43210",
      "(98765) 43210",
      "  9876543210  ",
    ]) {
      expect(normalizePhone(input), `input: ${input}`).toBe(expected);
    }
  });

  it("produces one canonical value, so friend search can match exactly", () => {
    const variants = ["9876543210", "+91 98765 43210", "098-765-43210"];
    const normalised = new Set(variants.map((v) => normalizePhone(v)));
    expect(normalised.size).toBe(1);
  });

  it("rejects input that is not a usable number", () => {
    for (const input of ["", "abc", "123", "12345678901234567890"]) {
      expect(normalizePhone(input), `input: ${input}`).toBeNull();
    }
  });

  it("explains the failure rather than just refusing", () => {
    const result = validatePhone("123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/10-digit/);
  });

  it("formats for display", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhone(undefined)).toBe("");
  });
});

describe("APP-007/008/027 — populated-vs-id references and null members", () => {
  const USER = "507f1f77bcf86cd799439011";
  const FRIEND = "507f1f77bcf86cd799439012";

  it("resolves an id from either shape", () => {
    expect(refId(USER)).toBe(USER);
    expect(refId({ _id: USER, name: "Alice" })).toBe(USER);
    expect(refId(null)).toBeUndefined();
    expect(refId(undefined)).toBeUndefined();
  });

  it("matches a POPULATED reference against a user id", () => {
    // The bug: `tx.from === user._id` is always false when `from` is a
    // populated object, so the edit form's direction toggle initialised to
    // "I Received" regardless of the truth — reversing the flow of money on
    // resubmission.
    const populated = { _id: USER, name: "Alice" };
    expect(populated === (USER as unknown)).toBe(false); // the bug
    expect(isRefTo(populated, USER)).toBe(true); // the fix
    expect(isRefTo(USER, USER)).toBe(true);
    expect(isRefTo(FRIEND, USER)).toBe(false);
    expect(isRefTo(null, USER)).toBe(false);
    expect(isRefTo(USER, undefined)).toBe(false);
  });

  it("reads a name from a populated reference, with a fallback", () => {
    expect(refName({ _id: USER, name: "Alice" })).toBe("Alice");
    expect(refName(USER)).toBe("Unknown");
    expect(refName(null, "Deleted user")).toBe("Deleted user");
  });

  it("survives null members without throwing", () => {
    // `chat.members.find(m => m._id !== currentUserId)` threw a TypeError on a
    // null member — inside Array.prototype.find — which surfaced as a red
    // screen on the Home tab for the SURVIVING user after the other account
    // was deleted.
    const members = [null, { _id: FRIEND, name: "Bob" }, undefined];
    expect(() =>
      (members as { _id: string }[]).find((m) => m._id !== USER),
    ).toThrow(); // the bug

    expect(compact(members)).toHaveLength(1);
    expect(otherMember(members, USER)?._id).toBe(FRIEND);
  });

  it("returns undefined when every other member is gone", () => {
    // Deliberately not falling back to members[0]: showing the current user as
    // their own counterparty is more confusing than a placeholder.
    expect(otherMember([null, { _id: USER, name: "Me" }], USER)).toBeUndefined();
    expect(otherMember([], USER)).toBeUndefined();
    expect(otherMember(null, USER)).toBeUndefined();
  });
});

describe("APP-010 — the timezone month-boundary bug", () => {
  it("pins a picked date to UTC midnight so it cannot shift months", () => {
    // A picker in IST yields local midnight on 1 Aug; `.toISOString()` made
    // that 2026-07-31T18:30:00Z, and the server filed it under JULY.
    const localMidnightAug1 = new Date(2026, 7, 1, 0, 0, 0, 0);
    expect(toApiDate(localMidnightAug1)).toBe("2026-08-01T00:00:00.000Z");
  });

  it("keeps the calendar date whatever time of day was picked", () => {
    const lateEvening = new Date(2026, 7, 1, 23, 45, 0, 0);
    const earlyMorning = new Date(2026, 7, 1, 0, 15, 0, 0);
    expect(toApiDate(lateEvening)).toBe(toApiDate(earlyMorning));
  });

  it("round-trips without drifting a day", () => {
    const original = new Date(2026, 7, 1);
    const restored = fromApiDate(toApiDate(original));
    expect(restored.getFullYear()).toBe(2026);
    expect(restored.getMonth()).toBe(7);
    expect(restored.getDate()).toBe(1);
  });

  it("round-trips every day of a month", () => {
    for (let day = 1; day <= 28; day++) {
      const d = new Date(2026, 1, day);
      const back = fromApiDate(toApiDate(d));
      expect(back.getDate(), `day ${day}`).toBe(day);
      expect(back.getMonth(), `day ${day}`).toBe(1);
    }
  });
});

describe("APP-009 — date picker bounds must include the edited value", () => {
  it("widens the minimum to include a last-month transaction", () => {
    // Hardcoded bounds put `value` outside [min, max], so the Android picker
    // clamped to the minimum and fired onChange unprompted — silently moving
    // the transaction to the 1st of the current month.
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1, 15);

    const monthStart = startOfCurrentMonth();
    expect(lastMonth < monthStart).toBe(true); // outside the old bound

    const min = pickerMinimumDate(lastMonth);
    expect(min <= fromApiDate(lastMonth)).toBe(true); // inside the new one
  });

  it("keeps the current month's start when adding a new entry", () => {
    expect(pickerMinimumDate(null).getTime()).toBe(
      startOfCurrentMonth().getTime(),
    );
  });

  it("never returns a maximum earlier than the value being edited", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(pickerMaximumDate(future) >= fromApiDate(future)).toBe(true);
  });
});
