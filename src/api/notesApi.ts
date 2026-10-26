import api from "./axios";
import type { NotePermission, NoteScope } from "../types";

// ========================
// Notes CRUD
// ========================

/** Drops undefined/empty values so they are not sent as `?q=` or `?label=`. */
const compact = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

export const listNotesApi = (params: {
  scope?: NoteScope;
  label?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}) => api.get("/notes", { params: compact(params) });

export const getNoteApi = (id: string) => api.get(`/notes/${id}`);

export const createNoteApi = (data: {
  title: string;
  body: string;
  personLabel?: string | null;
}) => api.post("/notes", data);

/** `version` is the optimistic-lock token; a stale one gets 409 with the latest note. */
export const updateNoteApi = (
  id: string,
  data: { title?: string; body?: string; version: number },
) => api.patch(`/notes/${id}`, data);

export const setNoteLabelApi = (id: string, personLabel: string | null) =>
  api.put(`/notes/${id}/label`, { personLabel });

export const deleteNoteApi = (id: string) => api.delete(`/notes/${id}`);

export const getNoteLabelsApi = () => api.get("/notes/labels");

// ========================
// Sharing
// ========================

export const getNoteSharesApi = (id: string) => api.get(`/notes/${id}/shares`);

export const upsertNoteSharesApi = (
  id: string,
  shares: { userId: string; permission: NotePermission }[],
) => api.put(`/notes/${id}/shares`, { shares });

export const revokeNoteShareApi = (id: string, userId: string) =>
  api.delete(`/notes/${id}/shares/${userId}`);

export const revokeAllNoteSharesApi = (id: string) =>
  api.delete(`/notes/${id}/shares`);
