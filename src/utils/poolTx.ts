/**
 * Pool entry rules (T-029), shared by the pool ledger and its details sheet.
 *
 * pending → verified | rejected. The adder edits or deletes while an entry is
 * pending, and edits & resubmits (or deletes) once it's rejected; any other
 * member verifies or rejects a pending entry. Verified entries are final, and a
 * closed pool is read-only. These mirror the server's checks so the App never
 * offers an action the server would refuse.
 */
import type { IPoolTx } from "../types";
import { isRefTo } from "./entities";
import { personName, type PeopleCtx, type TimelineEntry } from "./transactions";

export type PoolTxStatus = "pending" | "verified" | "rejected";

export type PoolTxAction = "edit" | "resubmit" | "delete" | "verify" | "reject";

/**
 * The entry's real state. `status` decides only when it says verified or
 * rejected: entries from before T-029 carry just the `verified` flag.
 */
export const poolTxStatusOf = (
  tx: Pick<IPoolTx, "status" | "verified">,
): PoolTxStatus => {
  if (tx.status === "verified" || tx.status === "rejected") return tx.status;
  return tx.verified ? "verified" : "pending";
};

/** What the signed-in member may do with this entry right now. */
export const poolTxActions = (
  tx: IPoolTx,
  meId: string | null | undefined,
  poolClosed: boolean,
): PoolTxAction[] => {
  if (!meId || poolClosed) return [];
  const status = poolTxStatusOf(tx);
  if (isRefTo(tx.addedBy, meId)) {
    if (status === "pending") return ["edit", "delete"];
    if (status === "rejected") return ["resubmit", "delete"];
    return [];
  }
  return status === "pending" ? ["verify", "reject"] : [];
};

/** Added → edited (×n) → verified / rejected (with the remark) / waiting. */
export const poolTxTimeline = (
  tx: IPoolTx,
  ctx: PeopleCtx,
): TimelineEntry[] => {
  const out: TimelineEntry[] = [
    { kind: "created", who: personName(tx.addedBy, ctx), at: tx.createdAt },
  ];
  if (tx.editedAt) {
    const entry: TimelineEntry = { kind: "edited", at: tx.editedAt };
    if (tx.editCount && tx.editCount > 1) entry.note = `${tx.editCount}×`;
    out.push(entry);
  }
  const status = poolTxStatusOf(tx);
  if (status === "verified") {
    out.push({
      kind: "verified",
      who: personName(tx.verifiedBy, ctx),
      at: tx.verifiedAt,
    });
  } else if (status === "rejected") {
    const entry: TimelineEntry = {
      kind: "rejected",
      who: personName(tx.rejectedBy, ctx),
      at: tx.rejectedAt,
    };
    if (tx.rejectionRemark) entry.note = tx.rejectionRemark;
    out.push(entry);
  } else {
    // Any member other than the adder can review, so nobody is named.
    out.push({ kind: "waiting" });
  }
  return out;
};

type PoolTxError = {
  response?: { status?: number; data?: { poolTx?: IPoolTx } };
};

/** 409: the entry changed since this phone read it. */
export const isPoolTxConflict = (error: unknown): boolean =>
  (error as PoolTxError | null | undefined)?.response?.status === 409;

/**
 * The server's latest copy of the entry attached to a refused request (409
 * changed, 400 already reviewed), so the row and sheet can show it.
 */
export const latestPoolTxFromError = (error: unknown): IPoolTx | null =>
  (error as PoolTxError | null | undefined)?.response?.data?.poolTx ?? null;

export type PoolTxRefusal =
  | { kind: "stale"; latest: IPoolTx } // show this version instead
  | { kind: "gone" } // 404: deleted, or no longer a member
  | { kind: "other" };

/** What a refused review / edit / delete means for the row on screen. */
export const poolTxRefusal = (error: unknown): PoolTxRefusal => {
  const latest = latestPoolTxFromError(error);
  if (latest) return { kind: "stale", latest };
  if ((error as PoolTxError | null | undefined)?.response?.status === 404) {
    return { kind: "gone" };
  }
  return { kind: "other" };
};

/**
 * The `remarks` field of an edit: only when it changed ("" clears it), so an
 * untouched remark is never re-validated or rewritten.
 */
export const remarksPatch = (
  original: string | undefined,
  edited: string,
): { remarks?: string } => {
  const next = edited.trim();
  return next === (original ?? "").trim() ? {} : { remarks: next };
};
