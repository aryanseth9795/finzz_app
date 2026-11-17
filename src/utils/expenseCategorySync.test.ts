import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExpenseCategoriesCache, IExpenseCategory } from "../types";

// In-memory stand-ins: the real cacheManager needs AsyncStorage and the real
// API needs the authenticated axios instance, neither of which runs in node.
const mocks = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string, _maxAge?: number) => store.get(key) ?? null),
    set: vi.fn(async (key: string, data: unknown) => {
      store.set(key, data);
    }),
    remove: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getExpenseCategoriesApi: vi.fn(),
    deleteExpenseCategoryApi: vi.fn(),
  };
});

vi.mock("./cacheManager", () => ({
  CACHE_KEYS: { EXPENSE_CATEGORIES: "expense_categories" },
  cacheManager: { get: mocks.get, set: mocks.set, remove: mocks.remove },
}));

vi.mock("../api/expenseApi", () => ({
  getExpenseCategoriesApi: mocks.getExpenseCategoriesApi,
  deleteExpenseCategoryApi: mocks.deleteExpenseCategoryApi,
}));

vi.mock("./logger", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  launchSyncAction,
  replyAction,
  withCategory,
  withoutCategory,
  readSavedCategories,
  subscribeCategories,
  syncCategoriesOnLaunch,
  ensureCategories,
  applyCategoryReply,
  removeExpenseCategory,
  resetCategorySync,
} from "./expenseCategorySync";

const KEY = "expense_categories";

const cat = (
  _id: string,
  name: string,
  type: IExpenseCategory["type"] = "debit",
): IExpenseCategory => ({ _id, name, type });

const FOOD = cat("1", "Food");
const RENT = cat("2", "Rent");
const FUEL = cat("3", "Fuel");

const cache = (version: number, categories: IExpenseCategory[] = []): ExpenseCategoriesCache => ({
  version,
  categories,
});

const getReply = (version: number, categories: IExpenseCategory[]) => ({
  data: { success: true, version, categories },
});

const httpError = (status: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { message: `status ${status}` } },
  });

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** Lets every pending promise callback run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetCategorySync();
  mocks.store.clear();
  vi.clearAllMocks();
  // clearAllMocks keeps queued *Once values; a test that stops early must not
  // hand its leftovers to the next one.
  mocks.getExpenseCategoriesApi.mockReset();
  mocks.deleteExpenseCategoryApi.mockReset();
});

describe("launchSyncAction (table 6.1)", () => {
  it("fetches when the server version is missing, whatever is saved", () => {
    expect(launchSyncAction(undefined, null)).toBe("fetch");
    expect(launchSyncAction(null, null)).toBe("fetch");
    expect(launchSyncAction(undefined, cache(3, [FOOD]))).toBe("fetch");
    expect(launchSyncAction(null, cache(0))).toBe("fetch");
  });

  it("does nothing when the saved copy matches the server version", () => {
    expect(launchSyncAction(3, cache(3, [FOOD]))).toBe("none");
    expect(launchSyncAction(0, cache(0))).toBe("none");
  });

  it("stores an empty list when the server is at 0 and nothing is saved", () => {
    expect(launchSyncAction(0, null)).toBe("store-empty");
  });

  it("fetches otherwise", () => {
    expect(launchSyncAction(4, cache(3, [FOOD]))).toBe("fetch");
    expect(launchSyncAction(2, cache(3, [FOOD]))).toBe("fetch");
    expect(launchSyncAction(0, cache(2, [FOOD]))).toBe("fetch");
    expect(launchSyncAction(5, null)).toBe("fetch");
  });
});

describe("replyAction (table 6.4)", () => {
  it("does nothing when the reply has neither a category nor a version", () => {
    expect(replyAction(cache(3), {})).toBe("none");
    expect(replyAction(null, {})).toBe("none");
  });

  it("fetches when there is no saved copy", () => {
    expect(replyAction(null, { category: FOOD, categoriesVersion: 1 })).toBe("fetch");
    expect(replyAction(null, { category: FOOD })).toBe("fetch");
    expect(replyAction(null, { categoriesVersion: 4 })).toBe("fetch");
  });

  it("adopts when the version is exactly one above the saved copy", () => {
    expect(replyAction(cache(3), { category: FUEL, categoriesVersion: 4 })).toBe("adopt");
    expect(replyAction(cache(0), { category: FUEL, categoriesVersion: 1 })).toBe("adopt");
    expect(replyAction(cache(3), { categoriesVersion: 4 })).toBe("adopt");
  });

  it("fetches when a version is present but is not saved + 1", () => {
    expect(replyAction(cache(3), { category: FUEL, categoriesVersion: 3 })).toBe("fetch");
    expect(replyAction(cache(3), { category: FUEL, categoriesVersion: 2 })).toBe("fetch");
    expect(replyAction(cache(3), { categoriesVersion: 6 })).toBe("fetch");
  });

  it("two phones: saved v3, another phone went to v4, this save replies v5 → fetch", () => {
    expect(replyAction(cache(3, [FOOD]), { category: FUEL, categoriesVersion: 5 })).toBe("fetch");
  });

  it("keeps the version when a category comes back without one", () => {
    expect(replyAction(cache(3), { category: FOOD })).toBe("keep");
  });
});

describe("withCategory", () => {
  it("adds the category sorted by key and sets the new version", () => {
    const next = withCategory(cache(3, [FOOD, RENT]), FUEL, 4);
    expect(next.version).toBe(4);
    expect(next.categories.map((c) => c.name)).toEqual(["Food", "Fuel", "Rent"]);
  });

  it("keeps the saved version when none is given", () => {
    expect(withCategory(cache(3, [FOOD]), RENT).version).toBe(3);
  });

  it("never stores a duplicate key, and the incoming spelling wins", () => {
    const next = withCategory(cache(3, [cat("9", "food  "), RENT]), FOOD);
    expect(next.categories).toEqual([FOOD, RENT]);
  });

  it("does not duplicate a category it already has", () => {
    expect(withCategory(cache(3, [FOOD]), FOOD).categories).toEqual([FOOD]);
  });

  it("treats debit and credit with the same name as different categories", () => {
    const creditFood = cat("4", "Food", "credit");
    const next = withCategory(cache(3, [FOOD]), creditFood, 4);
    expect(next.categories).toHaveLength(2);
    expect(next.categories).toEqual(expect.arrayContaining([FOOD, creditFood]));
  });

  it("does not mutate the saved copy", () => {
    const saved = cache(3, [RENT]);
    withCategory(saved, FOOD, 4);
    expect(saved).toEqual(cache(3, [RENT]));
  });
});

describe("withoutCategory", () => {
  it("removes by id and sets the new version", () => {
    expect(withoutCategory(cache(3, [FOOD, RENT]), "1", 4)).toEqual(cache(4, [RENT]));
  });

  it("keeps the saved version when none is given", () => {
    expect(withoutCategory(cache(3, [FOOD, RENT]), "2")).toEqual(cache(3, [FOOD]));
  });

  it("is a no-op on the list for an unknown id", () => {
    expect(withoutCategory(cache(3, [FOOD]), "zz")).toEqual(cache(3, [FOOD]));
  });
});

describe("readSavedCategories", () => {
  it("reads with an unlimited max age so the version, not the age, decides", async () => {
    mocks.store.set(KEY, cache(2, [FOOD]));
    await expect(readSavedCategories()).resolves.toEqual(cache(2, [FOOD]));
    expect(mocks.get).toHaveBeenCalledWith(KEY, Number.POSITIVE_INFINITY);
  });

  it("returns null when nothing is saved", async () => {
    await expect(readSavedCategories()).resolves.toBeNull();
  });
});

describe("syncCategoriesOnLaunch", () => {
  it("fetches and stores { version, categories } when the server version is missing", async () => {
    mocks.getExpenseCategoriesApi.mockResolvedValue(getReply(1, [FOOD]));
    await syncCategoriesOnLaunch(undefined);
    expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1);
    expect(mocks.store.get(KEY)).toEqual(cache(1, [FOOD]));
  });

  it("does nothing when the saved copy matches", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    await syncCategoriesOnLaunch(3);
    expect(mocks.getExpenseCategoriesApi).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("stores an empty list at version 0 without a request", async () => {
    await syncCategoriesOnLaunch(0);
    expect(mocks.getExpenseCategoriesApi).not.toHaveBeenCalled();
    expect(mocks.store.get(KEY)).toEqual(cache(0));
  });

  it("fetches when the server is ahead", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    mocks.getExpenseCategoriesApi.mockResolvedValue(getReply(5, [FOOD, RENT]));
    await syncCategoriesOnLaunch(5);
    expect(mocks.store.get(KEY)).toEqual(cache(5, [FOOD, RENT]));
  });

  it("swallows a failed fetch and keeps the saved copy", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    mocks.getExpenseCategoriesApi.mockRejectedValue(new Error("offline"));
    await expect(syncCategoriesOnLaunch(4)).resolves.toBeUndefined();
    expect(mocks.store.get(KEY)).toEqual(cache(3, [FOOD]));
  });
});

describe("ensureCategories", () => {
  it("fetches only when there is no saved copy", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    await ensureCategories();
    expect(mocks.getExpenseCategoriesApi).not.toHaveBeenCalled();

    mocks.store.clear();
    mocks.getExpenseCategoriesApi.mockResolvedValue(getReply(2, [RENT]));
    await ensureCategories();
    expect(mocks.store.get(KEY)).toEqual(cache(2, [RENT]));
  });

  it("shares one request between concurrent callers", async () => {
    const pending = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi.mockReturnValue(pending.promise);
    const both = Promise.all([ensureCategories(), syncCategoriesOnLaunch(undefined)]);
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalled());
    pending.resolve(getReply(1, [FOOD]));
    await both;
    expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1);
    expect(mocks.store.get(KEY)).toEqual(cache(1, [FOOD]));
  });

  it("swallows errors", async () => {
    mocks.getExpenseCategoriesApi.mockRejectedValue(new Error("offline"));
    await expect(ensureCategories()).resolves.toBeUndefined();
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

describe("logging out while a fetch is in flight (Review Focus 2)", () => {
  it("does not write the previous user's list after resetCategorySync()", async () => {
    const pending = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi.mockReturnValue(pending.promise);
    const run = ensureCategories();
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalled());

    resetCategorySync();
    pending.resolve(getReply(4, [FOOD, RENT]));
    await run;

    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.store.has(KEY)).toBe(false);
  });

  it("does not start the fetch if the reset lands before it begins", async () => {
    mocks.getExpenseCategoriesApi.mockResolvedValue(getReply(4, [FOOD]));
    const run = ensureCategories();
    resetCategorySync();
    await run;
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("lets the next user's fetch run instead of joining the old one", async () => {
    const old = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi.mockReturnValueOnce(old.promise);
    const oldRun = ensureCategories();
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1));

    resetCategorySync();
    mocks.getExpenseCategoriesApi.mockResolvedValueOnce(getReply(2, [RENT]));
    await ensureCategories();
    expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(2);
    expect(mocks.store.get(KEY)).toEqual(cache(2, [RENT]));

    old.resolve(getReply(7, [FOOD]));
    await oldRun;
    expect(mocks.store.get(KEY)).toEqual(cache(2, [RENT]));
  });
});

describe("applyCategoryReply", () => {
  it("adopt: adds the category with the new version", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    await applyCategoryReply({ category: FUEL, categoriesVersion: 4 });
    expect(mocks.store.get(KEY)).toEqual(cache(4, [FOOD, FUEL]));
    expect(mocks.getExpenseCategoriesApi).not.toHaveBeenCalled();
  });

  it("keep: adds the category and leaves the version alone", async () => {
    mocks.store.set(KEY, cache(3, [RENT]));
    await applyCategoryReply({ category: FOOD });
    expect(mocks.store.get(KEY)).toEqual(cache(3, [FOOD, RENT]));
    expect(mocks.getExpenseCategoriesApi).not.toHaveBeenCalled();
  });

  it("fetch: two phones, saved v3 and reply v5 refetches", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    mocks.getExpenseCategoriesApi.mockResolvedValue(getReply(5, [FOOD, FUEL, RENT]));
    await applyCategoryReply({ category: FUEL, categoriesVersion: 5 });
    expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1);
    expect(mocks.store.get(KEY)).toEqual(cache(5, [FOOD, FUEL, RENT]));
  });

  it("fetch: no saved copy refetches", async () => {
    mocks.getExpenseCategoriesApi.mockResolvedValue(getReply(1, [FOOD]));
    await applyCategoryReply({ category: FOOD, categoriesVersion: 1 });
    expect(mocks.store.get(KEY)).toEqual(cache(1, [FOOD]));
  });

  it("none: an empty reply writes nothing and requests nothing", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    await applyCategoryReply({});
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.getExpenseCategoriesApi).not.toHaveBeenCalled();
  });

  it("swallows a failed refetch", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    mocks.getExpenseCategoriesApi.mockRejectedValue(new Error("offline"));
    await expect(applyCategoryReply({ categoriesVersion: 9 })).resolves.toBeUndefined();
  });

  it("fetch: adds the category now with the version unchanged, and keeps it if the refetch fails", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    const pending = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi.mockReturnValue(pending.promise);

    const run = applyCategoryReply({ category: FUEL, categoriesVersion: 5 });
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1));
    expect(mocks.store.get(KEY)).toEqual(cache(3, [FOOD, FUEL]));

    pending.reject(new Error("offline"));
    await expect(run).resolves.toBeUndefined();
    expect(mocks.store.get(KEY)).toEqual(cache(3, [FOOD, FUEL]));
  });

  it("fetch: a reply older than the saved copy adds nothing locally", async () => {
    mocks.store.set(KEY, cache(5, [FOOD]));
    mocks.getExpenseCategoriesApi.mockRejectedValue(new Error("offline"));
    await applyCategoryReply({ category: FUEL, categoriesVersion: 4 });
    expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1);
    expect(mocks.store.get(KEY)).toEqual(cache(5, [FOOD]));
  });

  it("fetch: does not join a request that started before the reply", async () => {
    const first = deferred<ReturnType<typeof getReply>>();
    const second = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const ensure = ensureCategories();
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1));

    const run = applyCategoryReply({ category: FUEL, categoriesVersion: 5 });
    await settle();
    // The second request waits for the first to settle.
    expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1);

    first.resolve(getReply(4, [FOOD, RENT]));
    await ensure;
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(2));

    second.resolve(getReply(5, [FOOD, FUEL, RENT]));
    await run;
    expect(mocks.store.get(KEY)).toEqual(cache(5, [FOOD, FUEL, RENT]));
  });

  it("fetch: replies that arrive while a refetch waits share it", async () => {
    mocks.store.set(KEY, cache(3, [FOOD]));
    const first = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(getReply(6, [FOOD, FUEL, RENT]));
    const launch = syncCategoriesOnLaunch(4);
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1));

    const both = Promise.all([
      applyCategoryReply({ category: FUEL, categoriesVersion: 5 }),
      applyCategoryReply({ category: RENT, categoriesVersion: 6 }),
    ]);
    await settle();
    first.resolve(getReply(4, [FOOD]));
    await Promise.all([launch, both]);

    expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(2);
    expect(mocks.store.get(KEY)).toEqual(cache(6, [FOOD, FUEL, RENT]));
  });
});

describe("removeExpenseCategory", () => {
  it("adopt: removes the category with the new version", async () => {
    mocks.store.set(KEY, cache(3, [FOOD, RENT]));
    mocks.deleteExpenseCategoryApi.mockResolvedValue({ data: { success: true, categoriesVersion: 4 } });
    await removeExpenseCategory(FOOD);
    expect(mocks.deleteExpenseCategoryApi).toHaveBeenCalledWith("1");
    expect(mocks.store.get(KEY)).toEqual(cache(4, [RENT]));
    expect(mocks.getExpenseCategoriesApi).not.toHaveBeenCalled();
  });

  it("fetch: another phone changed the list too", async () => {
    mocks.store.set(KEY, cache(3, [FOOD, RENT]));
    mocks.deleteExpenseCategoryApi.mockResolvedValue({ data: { success: true, categoriesVersion: 6 } });
    mocks.getExpenseCategoriesApi.mockResolvedValue(getReply(6, [FUEL, RENT]));
    await removeExpenseCategory(FOOD);
    expect(mocks.store.get(KEY)).toEqual(cache(6, [FUEL, RENT]));
  });

  it("fetch: drops the chip now with the version unchanged, even if the refetch fails", async () => {
    mocks.store.set(KEY, cache(3, [FOOD, RENT]));
    mocks.deleteExpenseCategoryApi.mockResolvedValue({ data: { success: true, categoriesVersion: 5 } });
    const pending = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi.mockReturnValue(pending.promise);

    const run = removeExpenseCategory(FOOD);
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1));
    expect(mocks.store.get(KEY)).toEqual(cache(3, [RENT]));

    pending.reject(new Error("offline"));
    await expect(run).resolves.toBeUndefined();
    expect(mocks.store.get(KEY)).toEqual(cache(3, [RENT]));
  });

  it("fetch: does not join a request that started before the delete", async () => {
    mocks.store.set(KEY, cache(3, [FOOD, RENT]));
    const first = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(getReply(6, [FUEL, RENT]));
    const launch = syncCategoriesOnLaunch(4);
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(1));

    mocks.deleteExpenseCategoryApi.mockResolvedValue({ data: { success: true, categoriesVersion: 6 } });
    const run = removeExpenseCategory(FOOD);
    await settle();
    first.resolve(getReply(4, [FOOD, FUEL, RENT]));
    await Promise.all([launch, run]);

    expect(mocks.getExpenseCategoriesApi).toHaveBeenCalledTimes(2);
    expect(mocks.store.get(KEY)).toEqual(cache(6, [FUEL, RENT]));
  });

  it("404: removes it locally with the version unchanged, then refetches", async () => {
    mocks.store.set(KEY, cache(3, [FOOD, RENT]));
    mocks.deleteExpenseCategoryApi.mockRejectedValue(httpError(404));
    const pending = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi.mockReturnValue(pending.promise);

    const run = removeExpenseCategory(FOOD);
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalled());
    expect(mocks.store.get(KEY)).toEqual(cache(3, [RENT]));

    pending.resolve(getReply(5, [RENT]));
    await expect(run).resolves.toBeUndefined();
    expect(mocks.store.get(KEY)).toEqual(cache(5, [RENT]));
  });

  it("rethrows a non-404 failure and keeps the chip", async () => {
    mocks.store.set(KEY, cache(3, [FOOD, RENT]));
    const error = httpError(500);
    mocks.deleteExpenseCategoryApi.mockRejectedValue(error);
    await expect(removeExpenseCategory(FOOD)).rejects.toBe(error);
    expect(mocks.store.get(KEY)).toEqual(cache(3, [FOOD, RENT]));
    expect(mocks.getExpenseCategoriesApi).not.toHaveBeenCalled();
  });

  it("rethrows a network failure (no response)", async () => {
    const error = Object.assign(new Error("Network Error"), { request: {} });
    mocks.deleteExpenseCategoryApi.mockRejectedValue(error);
    await expect(removeExpenseCategory(FOOD)).rejects.toBe(error);
  });
});

describe("subscribeCategories", () => {
  it("notifies after every write and stops after unsubscribing", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCategories(listener);

    await syncCategoriesOnLaunch(0);
    expect(listener).toHaveBeenLastCalledWith(cache(0));

    await applyCategoryReply({ category: FOOD, categoriesVersion: 1 });
    expect(listener).toHaveBeenLastCalledWith(cache(1, [FOOD]));

    mocks.deleteExpenseCategoryApi.mockResolvedValue({ data: { success: true, categoriesVersion: 2 } });
    await removeExpenseCategory(FOOD);
    expect(listener).toHaveBeenLastCalledWith(cache(2));

    unsubscribe();
    const calls = listener.mock.calls.length;
    await applyCategoryReply({ category: RENT, categoriesVersion: 3 });
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it("is not told about a write that was dropped by a reset", async () => {
    const pending = deferred<ReturnType<typeof getReply>>();
    mocks.getExpenseCategoriesApi.mockReturnValue(pending.promise);
    const run = ensureCategories();
    await vi.waitFor(() => expect(mocks.getExpenseCategoriesApi).toHaveBeenCalled());

    const listener = vi.fn();
    const unsubscribe = subscribeCategories(listener);
    resetCategorySync();
    pending.resolve(getReply(4, [FOOD]));
    await run;
    expect(listener).not.toHaveBeenCalledWith(cache(4, [FOOD]));
    unsubscribe();
  });
});
