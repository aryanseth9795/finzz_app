import dayjs from "dayjs";
import type { ILastTransaction } from "../types";
import { txCalendarDay } from "./dates";

/**
 * The time label on a Home chat card (T-033).
 *
 * THE BUG THIS FIXES
 * The card formatted `lastTransaction.date` as "h:mm A". That field is the
 * calendar date the user picked, stored at UTC midnight (`toApiDate`), so it
 * has no time of day: in IST every card read "5:30 AM" while the details
 * sheet showed the real time from `createdAt`.
 *
 * Now the DAY comes from `date`, read with `txCalendarDay` so no timezone can
 * shift it (and legacy rows that stored a moment keep their local day), which
 * also matches the order the server sorts the list in. The
 * clock time comes from `createdAt`, and only when the transaction is dated
 * today and was added today. Otherwise it says "Today" rather than invent a
 * time (snapshots from before T-033 have no `createdAt`).
 */
export const chatCardTime = (
  lastTx: Pick<ILastTransaction, "date" | "createdAt"> | undefined,
  now: Date = new Date(),
): string => {
  if (!lastTx?.date) return "";
  const txDay = dayjs(txCalendarDay(lastTx.date));
  if (!txDay.isValid()) return "";

  const today = dayjs(now);
  if (txDay.isSame(today, "day")) {
    const added = lastTx.createdAt ? dayjs(lastTx.createdAt) : null;
    return added?.isValid() && added.isSame(today, "day")
      ? added.format("h:mm A")
      : "Today";
  }
  if (txDay.isSame(today.subtract(1, "day"), "day")) return "Yesterday";
  if (txDay.isSame(today, "year")) return txDay.format("DD MMM");
  return txDay.format("DD/MM/YY");
};
