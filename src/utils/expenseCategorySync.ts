/**
 * The phone's copy of the user's expense categories, kept in step with the
 * server by version number (spec section 6).
 *
 * The saved copy is `{ version, categories }`. The server raises the version
 * by exactly 1 for every real insert or delete, so comparing versions tells
 * the phone whether its copy is current, one step behind because of its own
 * change, or behind because another phone also changed the list. Only the
 * last case costs a request.
 *
 * The decision functions are pure and unit-tested. The I/O functions below
 * them never throw (a category list is a convenience, not a reason to show an
 * error), except `removeExpenseCategory`, whose failure the screen must show.
 */

import {
  getExpenseCategoriesApi,
  deleteExpenseCategoryApi,
} from "../api/expenseApi";
import { cacheManager, CACHE_KEYS } from "./cacheManager";
import { categoryKey } from "./expenseCategories";
import { logger } from "./logger";
import type {
  ExpenseCategoriesCache,
  ExpenseCategoryReply,
  IExpenseCategory,
} from "../types";

// ========================
// Pure decisions
// ========================

/** Table 6.1: what to do at launch, given the Profile call's version. */
export function launchSyncAction(
  serverVersion: number | null | undefined,
  saved: ExpenseCategoriesCache | null,
): "fetch" | "none" | "store-empty" {
  // Missing: never filled. The GET runs the server's first fill.
  if (serverVersion === undefined || serverVersion === null) return "fetch";
  if (saved && saved.version === serverVersion) return "none";
  // Filled and empty (every new account): nothing to fetch.
  if (serverVersion === 0 && !saved) return "store-empty";
  return "fetch";
}

/**
 * Table 6.4, the +1 rule. Copying a reply's version blindly would lose another
 * phone's change: saved v3, the other phone adds "Rent" (v4), this phone adds
 * "Fuel" (v5). Adopting 5 would leave "Rent" missing here for ever.
 */
export function replyAction(
  saved: ExpenseCategoriesCache | null,
  reply: ExpenseCategoryReply,
): "adopt" | "keep" | "fetch" | "none" {
  const hasVersion = typeof reply.categoriesVersion === "number";
  if (!reply.category && !hasVersion) return "none";
  if (!saved) return "fetch";
  if (hasVersion) {
    return reply.categoriesVersion === saved.version + 1 ? "adopt" : "fetch";
  }
  // A category with no version: it already existed on the server.
  return "keep";
}

const keyOf = categoryKey;

const sameCategory = (a: IExpenseCategory, b: IExpenseCategory) =>
  a._id === b._id || (a.type === b.type && keyOf(a.name) === keyOf(b.name));

/** Sorted by key like the server's list; type breaks ties between debit and credit. */
const byKey = (a: IExpenseCategory, b: IExpenseCategory) => {
  const ka = keyOf(a.name);
  const kb = keyOf(b.name);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
};

/**
 * The saved copy with `category` in it, replacing any entry with the same id
 * or the same type and key (the server's spelling wins). The version changes
 * only when one is given.
 */
export function withCategory(
  saved: ExpenseCategoriesCache,
  category: IExpenseCategory,
  version?: number,
): ExpenseCategoriesCache {
  const categories = saved.categories
    .filter((c) => !sameCategory(c, category))
    .concat(category)
    .sort(byKey);
  return { version: version ?? saved.version, categories };
}

/** The saved copy without the category `id`. The version changes only when one is given. */
export function withoutCategory(
  saved: ExpenseCategoriesCache,
  id: string,
  version?: number,
): ExpenseCategoriesCache {
  return {
    version: version ?? saved.version,
    categories: saved.categories.filter((c) => c._id !== id),
  };
}

// ========================
// Saved copy and sync
// ========================

type Listener = (cache: ExpenseCategoriesCache | null) => void;

const listeners = new Set<Listener>();

/**
 * Bumped on sign-out. Every write carries the generation it started under and
 * is dropped if that has moved on, so a fetch still in flight when the user
 * logs out cannot put their list back after `cacheManager.clearAll()`.
 */
let generation = 0;

/** The one list request in flight, shared by launch and the screen. */
let inFlight: Promise<void> | null = null;

/**
 * A request waiting for `inFlight` to settle before it starts. Replies and
 * removes use it: the request in flight may have been answered before their
 * change reached the server, so they must not join it.
 */
let queued: Promise<void> | null = null;

const notify = (cache: ExpenseCategoriesCache | null) => {
  listeners.forEach((listener) => {
    try {
      listener(cache);
    } catch (error) {
      logger.error("Category listener failed", error);
    }
  });
};

const save = async (cache: ExpenseCategoriesCache, gen: number) => {
  if (gen !== generation) return;
  await cacheManager.set(CACHE_KEYS.EXPENSE_CATEGORIES, cache);
  if (gen !== generation) {
    // Signed out while the write was landing: undo it.
    await cacheManager.remove(CACHE_KEYS.EXPENSE_CATEGORIES);
    return;
  }
  notify(cache);
};

const startFetch = (gen: number): Promise<void> => {
  const run = (async () => {
    try {
      const response = await getExpenseCategoriesApi();
      const { version, categories } = response.data ?? {};
      if (typeof version !== "number" || !Array.isArray(categories)) return;
      await save({ version, categories }, gen);
    } catch (error) {
      logger.error("Failed to load expense categories:", error);
    }
  })().finally(() => {
    if (inFlight === run) inFlight = null;
  });

  inFlight = run;
  return run;
};

/**
 * Gets the list and saves it. Joins the request in flight, unless `fresh`:
 * then it waits for that one and starts a new one, which fresh callers that
 * arrive before it starts share.
 */
const fetchAndSave = (
  gen: number,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<void> => {
  if (gen !== generation) return Promise.resolve();
  if (!inFlight) return startFetch(gen);
  if (!fresh) return inFlight;
  if (!queued) {
    const next: Promise<void> = inFlight.then(() => {
      if (queued === next) queued = null;
      // Anything in flight now started after the fresh callers arrived, so
      // joining it is fine.
      return fetchAndSave(gen);
    });
    queued = next;
  }
  return queued;
};

/** The saved copy, read with no age limit: the version decides freshness. */
export async function readSavedCategories(): Promise<ExpenseCategoriesCache | null> {
  const saved = await cacheManager.get<ExpenseCategoriesCache>(
    CACHE_KEYS.EXPENSE_CATEGORIES,
    Number.POSITIVE_INFINITY,
  );
  if (!saved || typeof saved.version !== "number" || !Array.isArray(saved.categories)) {
    return null;
  }
  return saved;
}

/** Called with the new copy after every write, and with null on sign-out. */
export function subscribeCategories(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Table 6.1, run in the background after the Profile call succeeds. */
export async function syncCategoriesOnLaunch(
  serverVersion: number | undefined,
): Promise<void> {
  const gen = generation;
  try {
    const saved = await readSavedCategories();
    const action = launchSyncAction(serverVersion, saved);
    if (action === "store-empty") await save({ version: 0, categories: [] }, gen);
    else if (action === "fetch") await fetchAndSave(gen);
  } catch (error) {
    logger.error("Category launch sync failed:", error);
  }
}

/** For the screen: fetch only if there's no saved copy (offline at launch). */
export async function ensureCategories(): Promise<void> {
  const gen = generation;
  try {
    if (await readSavedCategories()) return;
    await fetchAndSave(gen);
  } catch (error) {
    logger.error("Category sync failed:", error);
  }
}

/** Applies the category fields of an add/edit expense reply (table 6.4). */
export async function applyCategoryReply(
  reply: ExpenseCategoryReply,
): Promise<void> {
  const gen = generation;
  try {
    const saved = await readSavedCategories();
    const action = replyAction(saved, reply);
    if (action === "none") return;
    if (saved && reply.category && (action === "adopt" || action === "keep")) {
      const version = action === "adopt" ? reply.categoriesVersion : undefined;
      await save(withCategory(saved, reply.category, version), gen);
      return;
    }
    // "fetch", or a version bump with no category to apply it to.
    if (
      saved &&
      reply.category &&
      typeof reply.categoriesVersion === "number" &&
      reply.categoriesVersion > saved.version
    ) {
      // Show it now, version unchanged, so a failed refetch cannot lose it.
      // (A reply older than the saved copy adds nothing: that copy is newer.)
      await save(withCategory(saved, reply.category), gen);
    }
    await fetchAndSave(gen, { fresh: true });
  } catch (error) {
    logger.error("Failed to apply category reply:", error);
  }
}

const statusOf = (error: unknown) =>
  (error as { response?: { status?: number } } | null)?.response?.status;

/**
 * Deletes on the server, then takes the chip off locally. Throws the request's
 * error, except a 404, so the screen can alert and keep the chip.
 */
export async function removeExpenseCategory(
  category: IExpenseCategory,
): Promise<void> {
  const gen = generation;
  let categoriesVersion: number | undefined;
  try {
    const response = await deleteExpenseCategoryApi(category._id);
    categoriesVersion = response.data?.categoriesVersion;
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
    // Already gone (removed on another phone): drop it here and catch up.
    try {
      const saved = await readSavedCategories();
      if (saved) await save(withoutCategory(saved, category._id), gen);
      await fetchAndSave(gen, { fresh: true });
    } catch (inner) {
      logger.error("Failed to drop a removed category:", inner);
    }
    return;
  }

  try {
    const saved = await readSavedCategories();
    const action = replyAction(saved, { categoriesVersion });
    if (saved && action === "adopt") {
      await save(withoutCategory(saved, category._id, categoriesVersion), gen);
    } else if (saved && action === "none") {
      // Deleted, but the reply carried no version: drop it, version unchanged.
      await save(withoutCategory(saved, category._id), gen);
    } else if (action === "fetch") {
      // Drop it now, version unchanged, so a failed refetch cannot bring it back.
      if (saved) await save(withoutCategory(saved, category._id), gen);
      await fetchAndSave(gen, { fresh: true });
    }
  } catch (error) {
    logger.error("Failed to apply category removal:", error);
  }
}

/**
 * Call on sign-out, before `cacheManager.clearAll()`. Fetches and writes that
 * started before this are dropped, and the next caller starts a fresh request.
 */
export function resetCategorySync(): void {
  generation += 1;
  inFlight = null;
  queued = null;
  notify(null);
}
