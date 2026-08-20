import dayjs from "dayjs";

/**
 * Date handling for a ledger.
 *
 * THE BUG THIS FIXES
 * `DateTimePicker` yields LOCAL midnight; `.toISOString()` converts to UTC.
 * For a user at UTC+5:30, selecting 1 August produced
 * `2026-07-31T18:30:00.000Z`, and the server bucketed it into JULY — the entry
 * vanished from the month the user had chosen.
 *
 * A ledger month is a fact about the user's CALENDAR, not about an instant.
 * The client therefore sends UTC midnight of the selected calendar date, plus
 * a timezone offset (attached by the axios interceptor), and the server
 * derives the period in the user's frame.
 */

/**
 * Serialise a picked calendar date for the API.
 *
 * Takes the year/month/day the user actually saw and pins them to UTC
 * midnight, so the wire value cannot drift across a date boundary.
 */
export const toApiDate = (date: Date): string =>
  new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
  ).toISOString();

/** Minutes to add to UTC to reach local time (+330 for IST). */
export const tzOffsetMinutes = (): number => -new Date().getTimezoneOffset();

/**
 * Parse an API date back into the calendar date the user chose.
 *
 * The counterpart of `toApiDate`: reading UTC components avoids the device
 * timezone shifting a UTC-midnight value back onto the previous day.
 */
export const fromApiDate = (value: string | Date): Date => {
  const d = new Date(value);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** Display a stored date without letting the device timezone shift it. */
export const formatDate = (
  value: string | Date | undefined | null,
  pattern = "DD MMM YYYY",
): string => {
  if (!value) return "—";
  const d = fromApiDate(value);
  return dayjs(d).isValid() ? dayjs(d).format(pattern) : "—";
};

/** First moment of the current month, in the user's own calendar. */
export const startOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

/**
 * Lower bound for a date picker.
 *
 * When editing an existing entry the bound must not exclude that entry's own
 * date. Passing a `value` outside `[minimumDate, maximumDate]` makes the
 * Android picker clamp to the minimum and fire `onChange` without the user
 * touching anything — silently rewriting a last-month transaction to the 1st
 * of the current month.
 */
export const pickerMinimumDate = (existing?: Date | string | null): Date => {
  const monthStart = startOfCurrentMonth();
  if (!existing) return monthStart;
  const existingDate = fromApiDate(existing);
  return existingDate < monthStart ? existingDate : monthStart;
};

/** Upper bound: today, or the entry's own date if it is somehow later. */
export const pickerMaximumDate = (existing?: Date | string | null): Date => {
  const today = new Date();
  if (!existing) return today;
  const existingDate = fromApiDate(existing);
  return existingDate > today ? existingDate : today;
};

export const isSameCalendarMonth = (
  a: Date | string,
  b: Date | string,
): boolean => {
  const da = fromApiDate(a);
  const db = fromApiDate(b);
  return (
    da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth()
  );
};
