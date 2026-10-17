import { describe, expect, it } from "vitest";
import type { ITx } from "../types";
import {
  CARRY_FORWARD_ID,
  conflictTx,
  isTxConflict,
  latestTxFromError,
  personName,
  txActions,
  txDirectionText,
  txStatusOf,
  txTimeline,
} from "./transactions";

const ME = "u-me";
const SUMMER = "u-summer";
const ctx = {
  meId: ME,
  members: [
    { _id: ME, name: "Aryan" },
    { _id: SUMMER, name: "Summer" },
  ],
};

const tx = (over: Partial<ITx> = {}): ITx => ({
  _id: "t1",
  chatId: "c1",
  amount: 100,
  date: "2026-10-01",
  to: SUMMER,
  from: ME,
  addedBy: ME,
  verified: false,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  ...over,
});

describe("txStatusOf", () => {
  it("uses status when present", () => {
    expect(txStatusOf({ status: "rejected", verified: false })).toBe("rejected");
  });
  it("falls back to verified flag for legacy rows", () => {
    expect(txStatusOf({ verified: true })).toBe("verified");
    expect(txStatusOf({ verified: false })).toBe("pending");
  });
});

describe("personName", () => {
  it("my id (raw or populated) is You", () => {
    expect(personName(ME, ctx)).toBe("You");
    expect(personName({ _id: ME, name: "Aryan" }, ctx)).toBe("You");
  });
  it("populated object gives its name", () => {
    expect(personName({ _id: SUMMER, name: "Sum" }, ctx)).toBe("Sum");
  });
  it("raw id looks up members", () => {
    expect(personName(SUMMER, ctx)).toBe("Summer");
  });
  it("otherwise Unknown", () => {
    expect(personName("nobody", ctx)).toBe("Unknown");
    expect(personName(null, ctx)).toBe("Unknown");
    expect(personName(undefined, {})).toBe("Unknown");
  });
});

describe("txActions", () => {
  it("creator + pending -> edit", () => {
    expect(txActions(tx({ status: "pending" }), ME)).toEqual(["edit"]);
  });
  it("creator + rejected -> resubmit, delete", () => {
    expect(txActions(tx({ status: "rejected" }), ME)).toEqual(["resubmit", "delete"]);
  });
  it("creator + verified -> none", () => {
    expect(txActions(tx({ status: "verified", verified: true }), ME)).toEqual([]);
  });
  it("other + pending -> verify, reject", () => {
    expect(txActions(tx({ addedBy: SUMMER, status: "pending" }), ME)).toEqual(["verify", "reject"]);
  });
  it("other + verified / rejected -> none", () => {
    expect(txActions(tx({ addedBy: SUMMER, status: "verified", verified: true }), ME)).toEqual([]);
    expect(txActions(tx({ addedBy: SUMMER, status: "rejected" }), ME)).toEqual([]);
  });
  it("handles populated addedBy and legacy status", () => {
    expect(txActions(tx({ addedBy: { _id: ME, name: "Aryan" } }), ME)).toEqual(["edit"]);
    expect(txActions(tx({ addedBy: SUMMER, verified: true }), ME)).toEqual([]);
  });
  it("carry-forward -> none", () => {
    expect(txActions(tx({ _id: CARRY_FORWARD_ID }), ME)).toEqual([]);
    expect(txActions(tx({ _id: CARRY_FORWARD_ID, addedBy: SUMMER }), ME)).toEqual([]);
  });
});

describe("txTimeline", () => {
  it("pending: created then waiting on the other member", () => {
    expect(txTimeline(tx({ status: "pending" }), ctx)).toEqual([
      { kind: "created", who: "You", at: "2026-10-01T10:00:00Z" },
      { kind: "waiting", who: "Summer" },
    ]);
  });
  it("pending created by the other: waiting on You", () => {
    const t = txTimeline(tx({ addedBy: SUMMER, status: "pending" }), ctx);
    expect(t[0]).toMatchObject({ kind: "created", who: "Summer" });
    expect(t[1]).toMatchObject({ kind: "waiting", who: "You" });
  });
  it("verified", () => {
    const t = txTimeline(
      tx({ status: "verified", verified: true, verifiedBy: SUMMER, verifiedAt: "2026-10-02T00:00:00Z" }),
      ctx,
    );
    expect(t).toEqual([
      { kind: "created", who: "You", at: "2026-10-01T10:00:00Z" },
      { kind: "verified", who: "Summer", at: "2026-10-02T00:00:00Z" },
    ]);
  });
  it("rejected with remark", () => {
    const t = txTimeline(
      tx({
        status: "rejected",
        rejectedBy: { _id: SUMMER, name: "Summer" },
        rejectedAt: "2026-10-02T00:00:00Z",
        rejectionRemark: "wrong amount",
      }),
      ctx,
    );
    expect(t[1]).toEqual({
      kind: "rejected",
      who: "Summer",
      at: "2026-10-02T00:00:00Z",
      note: "wrong amount",
    });
  });
  it("edited entry, with count note only when count > 1", () => {
    const once = txTimeline(tx({ editedAt: "2026-10-01T12:00:00Z", editCount: 1 }), ctx);
    expect(once.map((e) => e.kind)).toEqual(["created", "edited", "waiting"]);
    expect(once[1].note).toBeUndefined();
    const thrice = txTimeline(tx({ editedAt: "2026-10-01T12:00:00Z", editCount: 3 }), ctx);
    expect(thrice[1]).toMatchObject({ kind: "edited", at: "2026-10-01T12:00:00Z", note: "3×" });
  });
  it("carry-forward -> empty", () => {
    expect(txTimeline(tx({ _id: CARRY_FORWARD_ID }), ctx)).toEqual([]);
  });
});

describe("txDirectionText", () => {
  it("from me", () => {
    expect(txDirectionText(tx({ from: ME, to: SUMMER }), { ...ctx, friendName: "Summer" })).toBe(
      "You gave Summer",
    );
  });
  it("from friend", () => {
    expect(txDirectionText(tx({ from: SUMMER, to: ME }), { ...ctx, friendName: "Summer" })).toBe(
      "Summer gave you",
    );
  });
  it("handles populated from", () => {
    const t = tx({ from: { _id: ME, name: "Aryan" } as unknown as string });
    expect(txDirectionText(t, { ...ctx, friendName: "Summer" })).toBe("You gave Summer");
  });
});

describe("409 helpers", () => {
  const err409 = { response: { status: 409, data: { txn: { _id: "t1" } } } };
  it("isTxConflict", () => {
    expect(isTxConflict(err409)).toBe(true);
    expect(isTxConflict({ response: { status: 500 } })).toBe(false);
    expect(isTxConflict(new Error("x"))).toBe(false);
    expect(isTxConflict(null)).toBe(false);
  });
  it("conflictTx", () => {
    expect(conflictTx(err409)).toEqual({ _id: "t1" });
    expect(conflictTx({ response: { status: 409, data: {} } })).toBeNull();
    expect(conflictTx(undefined)).toBeNull();
  });
});

describe("latestTxFromError", () => {
  const txn = { _id: "t1", amount: 5 };
  it.each([400, 403, 409])("returns the txn for status %i", (status) => {
    expect(latestTxFromError({ response: { status, data: { txn } } })).toEqual(txn);
  });
  it("returns null when no txn is present", () => {
    expect(latestTxFromError({ response: { status: 400, data: { message: "x" } } })).toBeNull();
    expect(latestTxFromError({ response: { status: 409 } })).toBeNull();
    expect(latestTxFromError({ response: { status: 409, data: { txn: null } } })).toBeNull();
  });
  it("returns null for non-axios errors", () => {
    expect(latestTxFromError(new Error("x"))).toBeNull();
    expect(latestTxFromError(null)).toBeNull();
    expect(latestTxFromError(undefined)).toBeNull();
  });
});
