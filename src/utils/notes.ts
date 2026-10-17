import dayjs from "dayjs";
import type { INote, INoteLabel, NoteRole, NoteScope } from "../types";

export const NOTE_TITLE_MAX = 120;
export const NOTE_BODY_MAX = 20000;

const DERIVED_TITLE_MAX = 60;
const PREVIEW_MAX = 140;

/** First non-empty body line, trimmed, with the index of the line it came from. */
const firstBodyLine = (body: string): { text: string; index: number } | null => {
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    if (text) return { text, index: i };
  }
  return null;
};

/**
 * What a note is called in lists and headers. A note with no title is common
 * (quick capture), so fall back to the first line of the body rather than
 * showing a blank row.
 */
export const noteDisplayTitle = (n: { title: string; body: string }): string => {
  const title = n.title.trim();
  if (title) return title;
  const line = firstBodyLine(n.body);
  return line ? line.text.slice(0, DERIVED_TITLE_MAX) : "Untitled note";
};

/**
 * Body snippet for a list row. When the title was derived from the body, that
 * line is dropped so the row does not say the same thing twice.
 */
export const notePreview = (n: { title: string; body: string }): string => {
  let body = n.body;
  if (!n.title.trim()) {
    const line = firstBodyLine(body);
    if (line) {
      body = body
        .split(/\r?\n/)
        .filter((_, i) => i !== line.index)
        .join("\n");
    }
  }
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_MAX ? `${flat.slice(0, PREVIEW_MAX)}…` : flat;
};

/**
 * Compact age of `iso` relative to `now`. "N h ago" is limited to the same
 * calendar day so a note edited at 23:00 does not read "13 h ago" the next
 * afternoon; that is "Yesterday".
 */
export const formatRelative = (iso: string, now: Date): string => {
  const then = dayjs(iso);
  const current = dayjs(now);
  const diffMs = current.diff(then);
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  if (then.isSame(current, "day")) return `${Math.floor(minutes / 60)} h ago`;
  if (then.isSame(current.subtract(1, "day"), "day")) return "Yesterday";
  return then.format("D MMM YYYY");
};

/** Whether the note has been changed since it was created (1 s tolerance). */
const wasEdited = (n: INote): boolean =>
  Math.abs(dayjs(n.editedAt).diff(dayjs(n.createdAt))) > 1000;

export const noteListTimestamp = (n: INote, now: Date): string =>
  wasEdited(n)
    ? `Edited ${formatRelative(n.editedAt, now)}`
    : `Created ${formatRelative(n.createdAt, now)}`;

export const noteFooter = (n: INote, viewerId: string, now: Date): string => {
  const created = `Created ${dayjs(n.createdAt).format("D MMM YYYY, h:mm A")}`;
  if (!wasEdited(n)) return created;
  const by =
    n.lastEditedBy && n.lastEditedBy._id !== viewerId
      ? ` by ${n.lastEditedBy.name}`
      : "";
  return `${created} · Edited ${formatRelative(n.editedAt, now)}${by}`;
};

export const canEditNote = (role: NoteRole): boolean =>
  role === "owner" || role === "editor";

export const canManageNote = (role: NoteRole): boolean => role === "owner";

/**
 * Append a page to the list. Dedupes by `_id` because a note edited between
 * two page fetches can appear in both; the incoming copy is the fresher one
 * and keeps the existing copy's position.
 */
export const mergeNotes = (existing: INote[], incoming: INote[]): INote[] => {
  const fresh = new Map(incoming.map((n) => [n._id, n]));
  const seen = new Set<string>();
  const out: INote[] = [];
  for (const n of existing) {
    seen.add(n._id);
    out.push(fresh.get(n._id) ?? n);
  }
  for (const n of incoming) {
    if (!seen.has(n._id)) {
      seen.add(n._id);
      out.push(n);
    }
  }
  return out;
};

type Draft = { title: string; body: string };

export const isNoteBlank = (d: Draft): boolean =>
  !d.title.trim() && !d.body.trim();

export const isNoteDirty = (saved: Draft, draft: Draft): boolean =>
  saved.title !== draft.title || saved.body !== draft.body;

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null | undefined)?.response?.status;

/** Maps an API error to the handling the editor needs. */
export const noteErrorKind = (
  error: unknown,
): "gone" | "forbidden" | "conflict" | "other" => {
  switch (statusOf(error)) {
    case 404:
      return "gone";
    case 403:
      return "forbidden";
    case 409:
      return "conflict";
    default:
      return "other";
  }
};

/** The server's latest copy of the note, carried on a 409 response. */
export const conflictNote = (error: unknown): INote | null =>
  (error as { response?: { data?: { note?: INote } } } | null | undefined)?.response
    ?.data?.note ?? null;

/**
 * True when `label` is a person id that no longer appears in the label list
 * (their last note was cleared or deleted). "none" and null are never stale.
 */
export const isLabelFilterStale = (
  label: string | null,
  labels: INoteLabel[],
): boolean =>
  label !== null && label !== "none" && !labels.some((l) => l.user._id === label);

/**
 * Hands out request ids so only the latest request may write results.
 * `close()` (screen unmount) makes every id, including ones issued afterwards,
 * permanently stale, so a response that lands after logout is dropped.
 */
export const createRequestGate = () => {
  let latest = 0;
  let closed = false;
  return {
    next: (): number => ++latest,
    isCurrent: (id: number): boolean => !closed && id === latest,
    close: (): void => {
      closed = true;
    },
  };
};

type NotesFilter = { scope: NoteScope; label: string | null; q: string };

export const sameNotesFilter = (a: NotesFilter, b: NotesFilter): boolean =>
  a.scope === b.scope && a.label === b.label && a.q === b.q;
