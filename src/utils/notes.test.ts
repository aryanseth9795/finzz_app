import { describe, it, expect } from "vitest";
import {
  NOTE_TITLE_MAX,
  NOTE_BODY_MAX,
  noteDisplayTitle,
  notePreview,
  formatRelative,
  noteListTimestamp,
  noteFooter,
  canEditNote,
  canManageNote,
  mergeNotes,
  isNoteBlank,
  isNoteDirty,
  noteErrorKind,
  conflictNote,
  isLabelFilterStale,
  createRequestGate,
  sameNotesFilter,
} from "./notes";
import { routeForNotification } from "./notificationRoute";
import type { INote, INoteLabel } from "../types";

// Local time, so the calendar-day rules are deterministic in any timezone.
const now = new Date(2026, 9, 17, 12, 0, 0);

const note = (over: Partial<INote> = {}): INote => ({
  _id: "n1",
  title: "T",
  body: "B",
  version: 1,
  createdAt: new Date(2026, 9, 10, 9, 5, 0).toISOString(),
  editedAt: new Date(2026, 9, 10, 9, 5, 0).toISOString(),
  role: "owner",
  owner: { _id: "u1", name: "Me" },
  lastEditedBy: null,
  ...over,
});

describe("limits", () => {
  it("exposes the title and body limits", () => {
    expect(NOTE_TITLE_MAX).toBe(120);
    expect(NOTE_BODY_MAX).toBe(20000);
  });
});

describe("formatRelative", () => {
  it("says just now under a minute", () => {
    expect(formatRelative(new Date(now.getTime() - 30_000).toISOString(), now)).toBe(
      "just now",
    );
  });
  it("counts minutes", () => {
    expect(formatRelative(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe(
      "5 min ago",
    );
  });
  it("counts hours on the same calendar day", () => {
    expect(formatRelative(new Date(2026, 9, 17, 9, 0, 0).toISOString(), now)).toBe(
      "3 h ago",
    );
  });
  it("says Yesterday for the previous calendar day", () => {
    expect(formatRelative(new Date(2026, 9, 16, 20, 0, 0).toISOString(), now)).toBe(
      "Yesterday",
    );
  });
  it("uses an absolute date for anything older", () => {
    expect(formatRelative(new Date(2026, 9, 12, 8, 0, 0).toISOString(), now)).toBe(
      "12 Oct 2026",
    );
  });
  it("treats a future time as just now", () => {
    expect(formatRelative(new Date(now.getTime() + 3_600_000).toISOString(), now)).toBe(
      "just now",
    );
  });
});

describe("noteDisplayTitle", () => {
  it("trims the title", () => {
    expect(noteDisplayTitle({ title: "  Plan ", body: "x" })).toBe("Plan");
  });
  it("falls back to the first non-empty body line", () => {
    expect(noteDisplayTitle({ title: "", body: "\n\nFirst line\nsecond" })).toBe(
      "First line",
    );
  });
  it("falls back to Untitled note", () => {
    expect(noteDisplayTitle({ title: " ", body: " \n " })).toBe("Untitled note");
  });
  it("cuts a long first line to 60 characters", () => {
    expect(noteDisplayTitle({ title: "", body: "a".repeat(80) })).toHaveLength(60);
  });
});

describe("notePreview", () => {
  it("drops the line used as the title and collapses newlines", () => {
    expect(notePreview({ title: "", body: "Title line\nsecond\n\nthird" })).toBe(
      "second third",
    );
  });
  it("keeps the whole body when the title is set", () => {
    expect(notePreview({ title: "Plan", body: "one\ntwo" })).toBe("one two");
  });
  it("adds an ellipsis after 140 characters", () => {
    const p = notePreview({ title: "Plan", body: "a".repeat(200) });
    expect(p).toBe("a".repeat(140) + "…");
  });
  it("does not add an ellipsis at exactly 140 characters", () => {
    expect(notePreview({ title: "Plan", body: "a".repeat(140) })).toBe("a".repeat(140));
  });
});

describe("noteListTimestamp", () => {
  it("says Created when never edited", () => {
    expect(noteListTimestamp(note(), now)).toMatch(/^Created /);
  });
  it("says Edited once the note changed", () => {
    const n = note({ editedAt: new Date(2026, 9, 17, 11, 0, 0).toISOString() });
    expect(noteListTimestamp(n, now)).toBe("Edited 1 h ago");
  });
});

describe("noteFooter", () => {
  const edited = note({
    editedAt: new Date(2026, 9, 17, 9, 0, 0).toISOString(),
    lastEditedBy: { _id: "u2", name: "Summer" },
  });
  it("names someone else who edited", () => {
    const f = noteFooter(edited, "u1", now);
    expect(f).toContain("Created 10 Oct 2026, 9:05 AM");
    expect(f).toContain("Edited 3 h ago by Summer");
  });
  it("omits the name when the viewer edited last", () => {
    const f = noteFooter(edited, "u2", now);
    expect(f).toContain("Edited 3 h ago");
    expect(f).not.toContain(" by ");
  });
  it("omits the Edited part when never edited", () => {
    expect(noteFooter(note(), "u1", now)).not.toContain("Edited");
  });
});

describe("roles", () => {
  it("canEditNote is owner or editor", () => {
    expect(canEditNote("owner")).toBe(true);
    expect(canEditNote("editor")).toBe(true);
    expect(canEditNote("viewer")).toBe(false);
  });
  it("canManageNote is owner only", () => {
    expect(canManageNote("owner")).toBe(true);
    expect(canManageNote("editor")).toBe(false);
    expect(canManageNote("viewer")).toBe(false);
  });
});

describe("mergeNotes", () => {
  it("dedupes by id and lets the incoming copy win", () => {
    const merged = mergeNotes(
      [note({ _id: "a", title: "old" }), note({ _id: "b" })],
      [note({ _id: "a", title: "new" }), note({ _id: "c" })],
    );
    expect(merged.map((n) => n._id)).toEqual(["a", "b", "c"]);
    expect(merged[0].title).toBe("new");
  });
});

describe("isNoteBlank / isNoteDirty", () => {
  it("is blank when title and body are whitespace", () => {
    expect(isNoteBlank({ title: " ", body: "\n" })).toBe(true);
    expect(isNoteBlank({ title: "", body: "x" })).toBe(false);
  });
  it("is dirty when title or body differ", () => {
    const saved = { title: "a", body: "b" };
    expect(isNoteDirty(saved, { title: "a", body: "b" })).toBe(false);
    expect(isNoteDirty(saved, { title: "a2", body: "b" })).toBe(true);
    expect(isNoteDirty(saved, { title: "a", body: "b2" })).toBe(true);
  });
});

describe("noteErrorKind / conflictNote", () => {
  it("maps statuses", () => {
    expect(noteErrorKind({ response: { status: 404 } })).toBe("gone");
    expect(noteErrorKind({ response: { status: 403 } })).toBe("forbidden");
    expect(noteErrorKind({ response: { status: 409 } })).toBe("conflict");
    expect(noteErrorKind({ response: { status: 500 } })).toBe("other");
    expect(noteErrorKind(new Error("Network Error"))).toBe("other");
    expect(noteErrorKind(undefined)).toBe("other");
  });
  it("returns the latest note from a 409", () => {
    const latest = note({ version: 5 });
    expect(conflictNote({ response: { status: 409, data: { note: latest } } })).toBe(
      latest,
    );
    expect(conflictNote({ response: { status: 409, data: {} } })).toBeNull();
    expect(conflictNote(new Error("x"))).toBeNull();
  });
});

describe("note_shared notification route", () => {
  it("opens the editor when a noteId is present", () => {
    expect(routeForNotification({ type: "note_shared", noteId: "n1" })).toEqual({
      name: "Notes",
      params: {
        screen: "NoteEditor",
        params: { noteId: "n1" },
        initial: false,
      },
    });
  });
  it("opens the notes list without a noteId", () => {
    expect(routeForNotification({ type: "note_shared" })).toEqual({
      name: "Notes",
      params: { screen: "NotesHome" },
    });
  });
});

describe("isLabelFilterStale", () => {
  const labels: INoteLabel[] = [
    { user: { _id: "u1", name: "Bob" }, count: 2 },
  ];
  it("is false with no label", () => {
    expect(isLabelFilterStale(null, labels)).toBe(false);
  });
  it('is false for the "none" label', () => {
    expect(isLabelFilterStale("none", [])).toBe(false);
  });
  it("is false when the id is present", () => {
    expect(isLabelFilterStale("u1", labels)).toBe(false);
  });
  it("is true when the id is absent", () => {
    expect(isLabelFilterStale("u2", labels)).toBe(true);
  });
  it("is true for an absent id with empty labels", () => {
    expect(isLabelFilterStale("u1", [])).toBe(true);
  });
});

describe("createRequestGate", () => {
  it("issues increasing ids", () => {
    const g = createRequestGate();
    const a = g.next();
    const b = g.next();
    expect(b).toBeGreaterThan(a);
  });
  it("makes older ids stale after next()", () => {
    const g = createRequestGate();
    const a = g.next();
    expect(g.isCurrent(a)).toBe(true);
    const b = g.next();
    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(b)).toBe(true);
  });
  it("is never current after close()", () => {
    const g = createRequestGate();
    const a = g.next();
    g.close();
    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(g.next())).toBe(false);
  });
});

describe("sameNotesFilter", () => {
  const base = { scope: "all" as const, label: null, q: "" };
  it("is true for equal filters", () => {
    expect(sameNotesFilter(base, { ...base })).toBe(true);
  });
  it("differs by scope", () => {
    expect(sameNotesFilter(base, { ...base, scope: "mine" })).toBe(false);
  });
  it("differs by label", () => {
    expect(sameNotesFilter(base, { ...base, label: "u1" })).toBe(false);
  });
  it("differs by q", () => {
    expect(sameNotesFilter(base, { ...base, q: "x" })).toBe(false);
  });
});
