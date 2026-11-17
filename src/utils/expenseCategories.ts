import type { ExpenseCategoryType, IExpenseCategory } from "../types";

/**
 * Category text rules for the suggestion chips.
 *
 * The server keeps a copy of `normalizeCategoryName`, `categoryKey` and
 * `isStorableCategory` (services/expenseCategories.ts) and both are tested on
 * the same cases. If the two drift, the phone flags a name the server already
 * has (harmless) or fails to flag one it doesn't (the chip never appears), so
 * change them together.
 */

/** Trim, then collapse runs of whitespace to one space. Spelling and case are kept. */
export const normalizeCategoryName = (raw: string): string =>
  (raw ?? "").trim().replace(/\s+/g, " ");

/** Matching key: the normalised name lowercased. "  FOOD  Court" → "food court". */
export const categoryKey = (raw: string): string => normalizeCategoryName(raw).toLowerCase();

/** Never store or flag a blank name or the old "-" placeholder. */
export const isStorableCategory = (raw: unknown): raw is string => {
  if (typeof raw !== "string") return false;
  const name = normalizeCategoryName(raw);
  return name !== "" && name !== "-";
};

/** The saved category of `type` whose key matches `text`, if any. */
export const findCategory = (
  list: IExpenseCategory[],
  type: ExpenseCategoryType,
  text: string
): IExpenseCategory | undefined => {
  const key = categoryKey(text);
  if (!key) return undefined;
  return list.find((c) => c.type === type && categoryKey(c.name) === key);
};

/**
 * Chips to show for `type` while the box holds `query`: case-insensitive
 * "contains", sorted by key. An empty query matches everything. Keys are
 * compared by code point, the same order as the server's sort on `key`.
 */
export const chipsFor = (
  list: IExpenseCategory[],
  type: ExpenseCategoryType,
  query: string
): IExpenseCategory[] => {
  const q = categoryKey(query);
  return list
    .filter((c) => c.type === type)
    .map((c) => ({ c, key: categoryKey(c.name) }))
    .filter(({ key }) => key.includes(q))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ c }) => c);
};

/** True when saving `text` should send `newCategory: true`. */
export const isNewCategory = (
  list: IExpenseCategory[],
  type: ExpenseCategoryType,
  text: string
): boolean => isStorableCategory(text) && !findCategory(list, type, text);

/** The saved spelling when the key matches ("food" → "Food"), otherwise the normalised text. */
export const resolveSpelling = (
  list: IExpenseCategory[],
  type: ExpenseCategoryType,
  text: string
): string => findCategory(list, type, text)?.name ?? normalizeCategoryName(text);

/**
 * Whether an edit touched the category. Only then is it resolved or flagged,
 * so an amount-only edit of an old "Fodo" doesn't bring back a removed chip
 * and an old "food" isn't rewritten to "Food". A type change counts, since the
 * name may not exist in the other type's list.
 */
export const categoryChangedOnEdit = (
  original: { category?: string | null; type: ExpenseCategoryType },
  next: { category: string; type: ExpenseCategoryType }
): boolean =>
  original.type !== next.type || categoryKey(original.category ?? "") !== categoryKey(next.category);
