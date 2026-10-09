import { describe, it, expect } from "vitest";
import { routeForNotification, isNewLaunchResponse } from "./notificationRoute";
import { pickInitialLedger, readCachedPage } from "./expenseLedger";
import type { IExpense, IExpenseLedger } from "../types";

/**
 * Bug: the app opened on the Expenses tab.
 *
 * `getLastNotificationResponseAsync()` returns the last tapped notification on
 * EVERY cold start, and unknown types (admin broadcasts) were routed to an
 * unregistered `Expenses → Notifications` screen.
 */
describe("routeForNotification", () => {
  it("routes unknown / admin broadcast types to Chats home, not Expenses", () => {
    expect(routeForNotification({ type: "admin_broadcast" })).toEqual({
      name: "Chats",
      params: { screen: "Home" },
    });
    expect(routeForNotification({})).toEqual({
      name: "Chats",
      params: { screen: "Home" },
    });
  });

  it("keeps known routes", () => {
    expect(routeForNotification({ type: "txn_added", chatId: "c1" })).toEqual({
      name: "Chats",
      params: { screen: "ChatScreen", params: { chatId: "c1" } },
    });
    expect(routeForNotification({ type: "pool_tx_added", poolId: "p1" })).toEqual({
      name: "Pool",
      params: { screen: "PoolChat", params: { poolId: "p1" } },
    });
    expect(routeForNotification({ type: "friend_request" })).toEqual({
      name: "Chats",
      params: { screen: "AddFriend" },
    });
  });

  it("returns null for no payload", () => {
    expect(routeForNotification(undefined)).toBeNull();
  });
});

describe("isNewLaunchResponse", () => {
  it("handles a launch tap only once", () => {
    expect(isNewLaunchResponse("n1", null)).toBe(true);
    expect(isNewLaunchResponse("n1", "n1")).toBe(false);
    expect(isNewLaunchResponse("n2", "n1")).toBe(true);
  });
  it("ignores a response without an id", () => {
    expect(isNewLaunchResponse("", null)).toBe(false);
  });
});

/** Bug: the Expense screen waited on the ledger network call before loading anything. */
const ledger = (year: number, month: number, id = `${year}-${month}`): IExpenseLedger => ({
  _id: id,
  userId: "u",
  year,
  month,
  status: "open",
  totalExpenses: 0,
  totalCredits: 0,
});

describe("pickInitialLedger", () => {
  const now = new Date(2026, 9, 10); // 10 Oct 2026

  it("picks the current month from cached ledgers", () => {
    const list = [ledger(2026, 9), ledger(2026, 10), ledger(2026, 8)];
    expect(pickInitialLedger(list, now)?._id).toBe("2026-10");
  });
  it("falls back to the first ledger when the current month is missing", () => {
    expect(pickInitialLedger([ledger(2026, 9)], now)?._id).toBe("2026-9");
  });
  it("returns null for no ledgers", () => {
    expect(pickInitialLedger([], now)).toBeNull();
  });
});

/** Bug: the cached first page claimed `hasMore` with no cursor, so scrolling re-fetched page 1. */
describe("readCachedPage", () => {
  const rows = [{ _id: "e1" }] as IExpense[];

  it("restores the stored cursor", () => {
    expect(readCachedPage({ expenses: rows, nextCursor: "c", hasMore: true })).toEqual({
      expenses: rows,
      nextCursor: "c",
      hasMore: true,
    });
  });
  it("treats a legacy array cache as having no further pages", () => {
    expect(readCachedPage(rows)).toEqual({ expenses: rows, nextCursor: null, hasMore: false });
  });
  it("never reports more pages without a cursor", () => {
    expect(readCachedPage({ expenses: rows, nextCursor: null, hasMore: true })?.hasMore).toBe(false);
  });
  it("returns null for nothing cached", () => {
    expect(readCachedPage(null)).toBeNull();
  });
});
