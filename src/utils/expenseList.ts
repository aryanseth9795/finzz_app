import dayjs from "dayjs";
import type { IExpense } from "../types";
import { fromApiDate } from "./dates";
import {
  categoryKey,
  isStorableCategory,
  normalizeCategoryName,
} from "./expenseCategories";
import { paymentLabel } from "./paymentMode";

/**
 * Pure helpers behind the grouped expense list (ExpenseScreen): day groups,
 * row text and the per-category colour. Kept out of the screen so they can be
 * tested without a renderer.
 */

/** Calendar day of an expense, "YYYY-MM-DD". Dates are stored as UTC midnight. */
export const dayKeyOf = (expense: Pick<IExpense, "date">): string =>
  dayjs(fromApiDate(expense.date)).format("YYYY-MM-DD");

/** The device's local calendar day, in the same form as `dayKeyOf`. */
export const localDayKey = (now: Date = new Date()): string =>
  dayjs(now).format("YYYY-MM-DD");

/** "Today", "Yesterday", otherwise "Thu, 23 Oct" (with the year when it isn't this year). */
export const dayLabel = (dayKey: string, todayKey: string): string => {
  const day = dayjs(dayKey);
  const today = dayjs(todayKey);
  if (day.isSame(today, "day")) return "Today";
  if (day.isSame(today.subtract(1, "day"), "day")) return "Yesterday";
  return day.format(day.year() === today.year() ? "ddd, D MMM" : "ddd, D MMM YYYY");
};

/** Debit and credit totals per day, over the rows loaded so far. */
export const dayTotals = (
  expenses: Pick<IExpense, "date" | "amount" | "type">[],
): Record<string, { debit: number; credit: number }> => {
  const totals: Record<string, { debit: number; credit: number }> = {};
  for (const e of expenses) {
    const key = dayKeyOf(e);
    const t = (totals[key] ??= { debit: 0, credit: 0 });
    if ((e.type || "debit") === "credit") t.credit += e.amount;
    else t.debit += e.amount;
  }
  return totals;
};

/** True when row `index` starts a new day, so it carries the day header. */
export const startsNewDay = (
  expenses: Pick<IExpense, "date">[],
  index: number,
): boolean =>
  index === 0 || dayKeyOf(expenses[index]) !== dayKeyOf(expenses[index - 1]);

/**
 * True when `a` comes before `b` in the server's order: date, then _id, both
 * newest first. ObjectId hex strings have a fixed length, so a string compare
 * orders them.
 */
const sortsBefore = (
  a: Pick<IExpense, "_id" | "date">,
  b: Pick<IExpense, "_id" | "date">,
): boolean => {
  const aTime = Date.parse(a.date);
  const bTime = Date.parse(b.date);
  if (aTime !== bTime) return aTime > bTime;
  return a._id > b._id;
};

/**
 * `list` with `expense` in its date's place (any row with the same _id is
 * dropped first), so a back-dated row joins its day instead of landing on top.
 * The loaded rows end at the last row of `list`, whose key the paging cursor
 * holds even when that row is the one being edited. A row that sorts after it
 * belongs to a page not loaded yet: while `hasMore`, it is left out for
 * pagination to bring, as appending it would break the cursor order.
 */
export const insertByDate = (
  list: IExpense[],
  expense: IExpense,
  hasMore: boolean,
): IExpense[] => {
  const rest = list.filter((e) => e._id !== expense._id);
  const last = list[list.length - 1];
  if (hasMore && last && sortsBefore(last, expense)) return rest;
  const slot = rest.findIndex((e) => sortsBefore(expense, e));
  if (slot === -1) return [...rest, expense];
  return [...rest.slice(0, slot), expense, ...rest.slice(slot)];
};

/** The row's category for display, or null for blank and the old "-". */
export const displayCategory = (category: unknown): string | null =>
  isStorableCategory(category) ? normalizeCategoryName(category) : null;

/**
 * Title and subtitle of a row. The title is the remark, else the category,
 * else "Expense" / "Money in". The subtitle joins with " · " the category
 * (only when the remark is the title) and the payment ("UPI", "Cash", ...),
 * e.g. "Food · UPI"; it is null when neither is there (old rows unchanged).
 */
export const rowText = (
  expense: Pick<IExpense, "remarks" | "category" | "type" | "paymentMode" | "paymentMethod">,
): { title: string; subtitle: string | null } => {
  const category = displayCategory(expense.category);
  const remark = expense.remarks?.trim() || null;
  const fallback = (expense.type || "debit") === "credit" ? "Money in" : "Expense";
  const title = remark ?? category ?? fallback;
  const parts = [remark ? category : null, paymentLabel(expense)].filter(
    (part): part is string => !!part,
  );
  return { title, subtitle: parts.length ? parts.join(" · ") : null };
};

/**
 * Stable palette slot for a category: the same name (any case or spacing)
 * always gets the same colour, on every screen and every launch.
 */
export const categoryColorIndex = (category: string, paletteSize: number): number => {
  const key = categoryKey(category);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % paletteSize;
};

/** The avatar's letter: the category's first character, uppercased. */
export const categoryInitial = (category: string): string =>
  Array.from(normalizeCategoryName(category))[0]?.toUpperCase() ?? "";
