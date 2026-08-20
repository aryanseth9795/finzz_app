/**
 * Helpers for fields the API returns either as an id string or as a populated
 * object, and for references that can be null.
 *
 * THE PROBLEM THESE SOLVE
 * `getTxns` populates `to`/`from`/`addedBy` into objects while `addtxns`
 * returns raw ids, and `types/index.ts` declared `to`/`from` as plain strings.
 * `ChatScreen` knew better and defended with a local helper; `AddEditTxScreen`
 * three files away trusted the declaration and compared `tx.from === user._id`
 * — always false against an object, so editing a rejected "I gave ₹5,000"
 * opened with the direction silently flipped to "I Received".
 *
 * Separately, an incomplete server-side delete cascade left dangling
 * ObjectIds that `populate` resolves to `null`, and the app dereferenced them
 * unguarded — a red-screen crash on the Home tab for the surviving user.
 *
 * Both are one class of bug: assuming a shape instead of narrowing it. These
 * helpers narrow once, in one place.
 */

/** Anything the API may return in a reference position. */
export type Ref<T = { _id: string; name?: string }> =
  | string
  | T
  | null
  | undefined;

/** The id of a reference, whatever shape it arrived in. */
export const refId = (value: Ref): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in value && value._id){
    return String(value._id);
  }
  return undefined;
};

/** True when the reference points at this user. Never throws. */
export const isRefTo = (value: Ref, userId?: string | null): boolean =>
  Boolean(userId) && refId(value) === userId;

/** Display name of a populated reference, or a fallback. */
export const refName = (
  value: Ref<{ _id: string; name?: string }>,
  fallback = "Unknown",
): string => {
  if (value && typeof value === "object" && "name" in value && value.name) {
    return value.name;
  }
  return fallback;
};

/**
 * Drop null/undefined entries from a populated array.
 *
 * `chat.members.find(m => m._id !== currentUserId)` throws a TypeError on a
 * null member — inside `Array.prototype.find`, which is why it surfaced as an
 * unexplained red screen rather than a handled error.
 */
export const compact = <T>(items: (T | null | undefined)[] | null | undefined): T[] =>
  Array.isArray(items) ? (items.filter(Boolean) as T[]) : [];

/**
 * The other participant in a 1:1 chat, or undefined.
 *
 * Returns undefined rather than falling back to `members[0]` when the only
 * other member is gone: showing the current user as their own counterparty is
 * more confusing than showing nothing, and callers can render a placeholder.
 */
export const otherMember = <T extends { _id: string }>(
  members: (T | null | undefined)[] | null | undefined,
  currentUserId?: string | null,
): T | undefined => {
  const present = compact(members);
  return present.find((m) => String(m._id) !== currentUserId);
};
