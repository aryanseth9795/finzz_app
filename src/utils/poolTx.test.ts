import { describe, it, expect } from "vitest";
import type { IPoolTx } from "../types";
import {
  poolTxStatusOf,
  poolTxActions,
  poolTxTimeline,
  latestPoolTxFromError,
  isPoolTxConflict,
} from "./poolTx";
import { routeForNotification } from "./notificationRoute";

const ME = "me";
const BOB = "bob";

const tx = (over: Partial<IPoolTx> = {}): IPoolTx => ({
  _id: "t1",
  poolId: "p1",
  amount: 5000,
  type: "credit",
  date: "2026-11-20T00:00:00.000Z",
  addedBy: { _id: ME, name: "Rohan" },
  verified: false,
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
  ...over,
});

describe("poolTxStatusOf", () => {
  it("uses status when present", () => {
    expect(poolTxStatusOf(tx({ status: "rejected" }))).toBe("rejected");
    expect(poolTxStatusOf(tx({ status: "verified", verified: true }))).toBe("verified");
  });
  it("falls back to `verified` for entries from before T-029", () => {
    expect(poolTxStatusOf(tx({ verified: true }))).toBe("verified");
    expect(poolTxStatusOf(tx({ verified: false }))).toBe("pending");
  });
  it("never trusts a bare pending over verified:true", () => {
    expect(poolTxStatusOf(tx({ status: "pending", verified: true }))).toBe("verified");
  });
});

describe("poolTxActions", () => {
  it("the adder can edit or delete a pending entry", () => {
    expect(poolTxActions(tx(), ME, false)).toEqual(["edit", "delete"]);
  });
  it("the adder can resubmit or delete a rejected entry", () => {
    expect(poolTxActions(tx({ status: "rejected" }), ME, false)).toEqual([
      "resubmit",
      "delete",
    ]);
  });
  it("nobody can change a verified entry", () => {
    const v = tx({ status: "verified", verified: true });
    expect(poolTxActions(v, ME, false)).toEqual([]);
    expect(poolTxActions(v, BOB, false)).toEqual([]);
  });
  it("another member can verify or reject a pending entry", () => {
    expect(poolTxActions(tx(), BOB, false)).toEqual(["verify", "reject"]);
  });
  it("another member has nothing to do on a rejected entry", () => {
    expect(poolTxActions(tx({ status: "rejected" }), BOB, false)).toEqual([]);
  });
  it("a closed pool is read-only for everyone", () => {
    expect(poolTxActions(tx(), ME, true)).toEqual([]);
    expect(poolTxActions(tx(), BOB, true)).toEqual([]);
  });
  it("no actions without a signed-in user", () => {
    expect(poolTxActions(tx(), null, false)).toEqual([]);
    expect(poolTxActions(tx(), undefined, false)).toEqual([]);
  });
  it("works when addedBy is a raw id or a deleted (null) user", () => {
    expect(poolTxActions(tx({ addedBy: ME }), ME, false)).toEqual(["edit", "delete"]);
    expect(poolTxActions(tx({ addedBy: null as never }), ME, false)).toEqual([
      "verify",
      "reject",
    ]);
  });
});

describe("poolTxTimeline", () => {
  const ctx = { meId: BOB, members: [{ _id: ME, name: "Rohan" }] };

  it("pending: added, then waiting for another member", () => {
    expect(poolTxTimeline(tx(), ctx)).toEqual([
      { kind: "created", who: "Rohan", at: "2026-11-20T10:00:00.000Z" },
      { kind: "waiting" },
    ]);
  });

  it("edited entries show the edit and the count when more than one", () => {
    const t = poolTxTimeline(
      tx({ editedAt: "2026-11-21T09:00:00.000Z", editCount: 3 }),
      ctx,
    );
    expect(t[1]).toEqual({
      kind: "edited",
      at: "2026-11-21T09:00:00.000Z",
      note: "3×",
    });
    const once = poolTxTimeline(tx({ editedAt: "2026-11-21T09:00:00.000Z", editCount: 1 }), ctx);
    expect(once[1]).toEqual({ kind: "edited", at: "2026-11-21T09:00:00.000Z" });
  });

  it("verified: who and when, 'You' for me", () => {
    const t = poolTxTimeline(
      tx({
        status: "verified",
        verified: true,
        verifiedBy: { _id: BOB, name: "Akash" },
        verifiedAt: "2026-11-22T08:00:00.000Z",
      }),
      ctx,
    );
    expect(t[t.length - 1]).toEqual({
      kind: "verified",
      who: "You",
      at: "2026-11-22T08:00:00.000Z",
    });
  });

  it("rejected: who, when and the remark", () => {
    const t = poolTxTimeline(
      tx({
        status: "rejected",
        rejectedBy: { _id: "kabir", name: "Kabir" },
        rejectedAt: "2026-11-22T08:00:00.000Z",
        rejectionRemark: "galat amount",
      }),
      ctx,
    );
    expect(t[t.length - 1]).toEqual({
      kind: "rejected",
      who: "Kabir",
      at: "2026-11-22T08:00:00.000Z",
      note: "galat amount",
    });
  });

  it("rejected with no remark has no note", () => {
    const t = poolTxTimeline(
      tx({ status: "rejected", rejectedBy: "kabir", rejectionRemark: "" }),
      { meId: BOB, members: [{ _id: "kabir", name: "Kabir" }] },
    );
    expect(t[t.length - 1]).toEqual({ kind: "rejected", who: "Kabir", at: undefined });
  });
});

describe("errors carrying the latest entry", () => {
  it("reads poolTx from a 409 / 400 reply", () => {
    const latest = tx({ amount: 4000 });
    const err = { response: { status: 409, data: { poolTx: latest } } };
    expect(isPoolTxConflict(err)).toBe(true);
    expect(latestPoolTxFromError(err)).toBe(latest);
    const reviewed = { response: { status: 400, data: { poolTx: latest } } };
    expect(isPoolTxConflict(reviewed)).toBe(false);
    expect(latestPoolTxFromError(reviewed)).toBe(latest);
  });
  it("is null-safe", () => {
    expect(latestPoolTxFromError(null)).toBeNull();
    expect(latestPoolTxFromError(new Error("x"))).toBeNull();
    expect(isPoolTxConflict(undefined)).toBe(false);
  });
});


describe("pool_tx_rejected notification", () => {
  it("opens the pool, like the other pool entry notifications", () => {
    expect(routeForNotification({ type: "pool_tx_rejected", poolId: "p1" })).toEqual({
      name: "Pool",
      params: { screen: "PoolChat", params: { poolId: "p1" } },
    });
    expect(routeForNotification({ type: "pool_tx_rejected" })).toEqual({
      name: "Pool",
      params: { screen: "PoolList" },
    });
  });
});
