import type { RandomBytes } from "./crypto";

export interface VaultGroup {
  id: string;
  name: string;
  icon: string;
  order: number;
}

export interface VaultEntry {
  id: string;
  groupId: string | null;
  title: string;
  loginLabel: string;
  loginValue: string;
  password: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultData {
  groups: VaultGroup[];
  entries: VaultEntry[];
}

export type EntryInput = Omit<VaultEntry, "id" | "createdAt" | "updatedAt">;

export const EMPTY_VAULT: VaultData = { groups: [], entries: [] };

export const LOGIN_LABEL_PRESETS = ["Username", "Email", "Gmail", "Insta ID", "Phone"];

/** Ionicons names offered when creating a group. */
export const GROUP_ICONS = [
  "folder", "people", "card", "mail", "logo-google", "logo-instagram",
  "briefcase", "school", "game-controller", "cart", "globe", "key",
];

export class VaultValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultValidationError";
  }
}

export const newId = (rand: RandomBytes): string =>
  Array.from(rand(12), (b) => b.toString(16).padStart(2, "0")).join("");

const cleanEntry = (data: VaultData, input: EntryInput): EntryInput => {
  const title = input.title.trim();
  const loginLabel = input.loginLabel.trim();
  if (title.length < 1 || title.length > 60) {
    throw new VaultValidationError("Title must be 1–60 characters");
  }
  if (loginLabel.length < 1 || loginLabel.length > 20) {
    throw new VaultValidationError("Login label must be 1–20 characters");
  }
  if (input.notes.length > 2000) {
    throw new VaultValidationError("Notes must be 2000 characters or fewer");
  }
  if (input.groupId !== null && !data.groups.some((g) => g.id === input.groupId)) {
    throw new VaultValidationError("That group no longer exists");
  }
  return {
    groupId: input.groupId,
    title,
    loginLabel,
    loginValue: input.loginValue.trim(),
    // Passwords are stored exactly as typed; spaces can be significant.
    password: input.password,
    notes: input.notes,
  };
};

export const addEntry = (data: VaultData, input: EntryInput, id: string, now: string): VaultData => ({
  ...data,
  entries: [...data.entries, { ...cleanEntry(data, input), id, createdAt: now, updatedAt: now }],
});

export const updateEntry = (data: VaultData, id: string, input: EntryInput, now: string): VaultData => {
  const clean = cleanEntry(data, input);
  return {
    ...data,
    entries: data.entries.map((e) => (e.id === id ? { ...e, ...clean, updatedAt: now } : e)),
  };
};

export const deleteEntry = (data: VaultData, id: string): VaultData => ({
  ...data,
  entries: data.entries.filter((e) => e.id !== id),
});

const cleanGroupName = (data: VaultData, name: string, exceptId?: string): string => {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 30) {
    throw new VaultValidationError("Group name must be 1–30 characters");
  }
  const lower = clean.toLowerCase();
  if (data.groups.some((g) => g.id !== exceptId && g.name.toLowerCase() === lower)) {
    throw new VaultValidationError("A group with that name already exists");
  }
  return clean;
};

export const sortedGroups = (data: VaultData): VaultGroup[] =>
  [...data.groups].sort((a, b) => a.order - b.order);

export const addGroup = (data: VaultData, name: string, icon: string, id: string): VaultData => {
  const order = data.groups.reduce((m, g) => Math.max(m, g.order), -1) + 1;
  return { ...data, groups: [...data.groups, { id, name: cleanGroupName(data, name), icon, order }] };
};

export const updateGroup = (data: VaultData, id: string, name: string, icon: string): VaultData => {
  const clean = cleanGroupName(data, name, id);
  return { ...data, groups: data.groups.map((g) => (g.id === id ? { ...g, name: clean, icon } : g)) };
};

export const moveGroup = (data: VaultData, id: string, dir: -1 | 1): VaultData => {
  const sorted = sortedGroups(data);
  const i = sorted.findIndex((g) => g.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return data;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return { ...data, groups: sorted.map((g, order) => ({ ...g, order })) };
};

export const deleteGroup = (
  data: VaultData,
  id: string,
  mode: "keepEntries" | "deleteEntries",
): VaultData => ({
  groups: data.groups.filter((g) => g.id !== id),
  entries:
    mode === "deleteEntries"
      ? data.entries.filter((e) => e.groupId !== id)
      : data.entries.map((e) => (e.groupId === id ? { ...e, groupId: null } : e)),
});

/** Plain substring search over non-secret fields only: never passwords or notes. */
export const filterEntries = (data: VaultData, groupId: string | "all", query: string): VaultEntry[] => {
  const q = query.trim().toLowerCase();
  return data.entries
    .filter((e) => groupId === "all" || e.groupId === groupId)
    .filter(
      (e) =>
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.loginLabel.toLowerCase().includes(q) ||
        e.loginValue.toLowerCase().includes(q),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
};

export const groupName = (data: VaultData, groupId: string | null): string =>
  data.groups.find((g) => g.id === groupId)?.name ?? "Ungrouped";
