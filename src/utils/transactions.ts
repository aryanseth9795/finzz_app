import type { ITx } from "../types";
import { isRefTo, refId, type Ref } from "./entities";

export type TxStatus = "pending" | "verified" | "rejected";

export const CARRY_FORWARD_ID = "carry-forward";

/** Effective status; legacy rows only carry the `verified` flag. */
export const txStatusOf = (tx: Pick<ITx, "status" | "verified">): TxStatus =>
  tx.status ?? (tx.verified ? "verified" : "pending");

export interface PeopleCtx {
  meId?: string | null;
  members?: { _id: string; name?: string }[];
}

/** Display name for a user reference (raw id or populated object). */
export const personName = (ref: unknown, ctx: PeopleCtx): string => {
  const id = refId(ref as Ref);
  if (id && ctx.meId && id === ctx.meId) return "You";
  if (ref && typeof ref === "object" && "name" in ref) {
    const name = (ref as { name?: string }).name;
    if (name) return name;
  }
  if (id) {
    const member = ctx.members?.find((m) => m && String(m._id) === id);
    if (member?.name) return member.name;
  }
  return "Unknown";
};

export type TxAction = "edit" | "resubmit" | "delete" | "verify" | "reject";

/** Actions the current user may take on a transaction. */
export const txActions = (tx: ITx, meId?: string | null): TxAction[] => {
  if (tx._id === CARRY_FORWARD_ID || !meId) return [];
  const status = txStatusOf(tx);
  const mine = isRefTo(tx.addedBy, meId);
  if (mine) {
    if (status === "pending") return ["edit"];
    if (status === "rejected") return ["resubmit", "delete"];
    return [];
  }
  return status === "pending" ? ["verify", "reject"] : [];
};

export interface TimelineEntry {
  kind: "created" | "edited" | "verified" | "rejected" | "waiting";
  who?: string;
  at?: string;
  note?: string;
}

/** The party who still has to act: the participant that is not the creator. */
const otherParty = (tx: ITx, ctx: PeopleCtx): unknown => {
  const creator = refId(tx.addedBy as Ref);
  const from = refId(tx.from as Ref);
  const to = refId(tx.to as Ref);
  if (from && from !== creator) return tx.from;
  if (to && to !== creator) return tx.to;
  return ctx.members?.find((m) => m && String(m._id) !== creator);
};

export const txTimeline = (tx: ITx, ctx: PeopleCtx): TimelineEntry[] => {
  if (tx._id === CARRY_FORWARD_ID) return [];
  const out: TimelineEntry[] = [
    { kind: "created", who: personName(tx.addedBy, ctx), at: tx.createdAt },
  ];
  if (tx.editedAt) {
    const entry: TimelineEntry = { kind: "edited", at: tx.editedAt };
    if (tx.editCount && tx.editCount > 1) entry.note = `${tx.editCount}×`;
    out.push(entry);
  }
  const status = txStatusOf(tx);
  if (status === "verified") {
    out.push({ kind: "verified", who: personName(tx.verifiedBy, ctx), at: tx.verifiedAt });
  } else if (status === "rejected") {
    out.push({
      kind: "rejected",
      who: personName(tx.rejectedBy, ctx),
      at: tx.rejectedAt,
      note: tx.rejectionRemark,
    });
  } else {
    out.push({ kind: "waiting", who: personName(otherParty(tx, ctx), ctx) });
  }
  return out;
};

/** "You gave Summer" / "Summer gave you". */
export const txDirectionText = (
  tx: ITx,
  ctx: PeopleCtx & { friendName?: string },
): string => {
  const fromMe = isRefTo(tx.from as Ref, ctx.meId);
  const friend =
    ctx.friendName ?? personName(fromMe ? tx.to : tx.from, ctx);
  return fromMe ? `You gave ${friend}` : `${friend} gave you`;
};

type ConflictError = { response?: { status?: number; data?: { txn?: ITx } } };

export const isTxConflict = (error: unknown): boolean =>
  (error as ConflictError | null | undefined)?.response?.status === 409;

export const conflictTx = (error: unknown): ITx | null =>
  (error as ConflictError | null | undefined)?.response?.data?.txn ?? null;
