import { describe, it, expect } from "vitest";
import {
  EMPTY_VAULT,
  addEntry,
  updateEntry,
  deleteEntry,
  addGroup,
  updateGroup,
  moveGroup,
  deleteGroup,
  sortedGroups,
  filterEntries,
  VaultValidationError,
  type EntryInput,
  type VaultData,
} from "./model";

const NOW = "2026-10-10T10:00:00.000Z";
const input = (over: Partial<EntryInput> = {}): EntryInput => ({
  groupId: null,
  title: "Gmail",
  loginLabel: "Gmail",
  loginValue: "me@gmail.com",
  password: "secret-pass",
  notes: "",
  ...over,
});

const withGroups = (): VaultData => {
  let d = addGroup(EMPTY_VAULT, "Social", "people", "g1");
  d = addGroup(d, "Banks", "card", "g2");
  return d;
};

describe("entries", () => {
  it("adds, updates and deletes", () => {
    let d = addEntry(EMPTY_VAULT, input(), "e1", NOW);
    expect(d.entries).toHaveLength(1);
    expect(d.entries[0]).toMatchObject({ id: "e1", title: "Gmail", createdAt: NOW, updatedAt: NOW });

    d = updateEntry(d, "e1", input({ title: "Work Gmail" }), "2026-10-11T00:00:00.000Z");
    expect(d.entries[0]).toMatchObject({ title: "Work Gmail", createdAt: NOW, updatedAt: "2026-10-11T00:00:00.000Z" });

    d = deleteEntry(d, "e1");
    expect(d.entries).toHaveLength(0);
  });

  it("trims and validates fields", () => {
    expect(addEntry(EMPTY_VAULT, input({ title: "  Insta  " }), "e1", NOW).entries[0].title).toBe("Insta");
    expect(() => addEntry(EMPTY_VAULT, input({ title: "  " }), "e1", NOW)).toThrow(VaultValidationError);
    expect(() => addEntry(EMPTY_VAULT, input({ title: "x".repeat(61) }), "e1", NOW)).toThrow(VaultValidationError);
    expect(() => addEntry(EMPTY_VAULT, input({ loginLabel: "" }), "e1", NOW)).toThrow(VaultValidationError);
    expect(() => addEntry(EMPTY_VAULT, input({ loginLabel: "x".repeat(21) }), "e1", NOW)).toThrow(VaultValidationError);
    expect(() => addEntry(EMPTY_VAULT, input({ notes: "x".repeat(2001) }), "e1", NOW)).toThrow(VaultValidationError);
    expect(() => addEntry(EMPTY_VAULT, input({ groupId: "missing" }), "e1", NOW)).toThrow(VaultValidationError);
  });

  it("does not trim passwords", () => {
    const d = addEntry(EMPTY_VAULT, input({ password: " spaced " }), "e1", NOW);
    expect(d.entries[0].password).toBe(" spaced ");
  });

  it("does not mutate the input data", () => {
    const before = JSON.stringify(EMPTY_VAULT);
    addEntry(EMPTY_VAULT, input(), "e1", NOW);
    expect(JSON.stringify(EMPTY_VAULT)).toBe(before);
  });
});

describe("groups", () => {
  it("adds in order and rejects duplicate names case-insensitively", () => {
    const d = withGroups();
    expect(sortedGroups(d).map((g) => g.name)).toEqual(["Social", "Banks"]);
    expect(() => addGroup(d, "  social ", "people", "g3")).toThrow(VaultValidationError);
    expect(() => addGroup(d, "", "people", "g3")).toThrow(VaultValidationError);
    expect(() => addGroup(d, "x".repeat(31), "people", "g3")).toThrow(VaultValidationError);
  });

  it("renames, allowing the same name on the same group", () => {
    const d = updateGroup(withGroups(), "g1", "Social", "chatbubbles");
    expect(d.groups.find((g) => g.id === "g1")?.icon).toBe("chatbubbles");
    expect(() => updateGroup(d, "g1", "banks", "card")).toThrow(VaultValidationError);
  });

  it("reorders", () => {
    const d = moveGroup(withGroups(), "g2", -1);
    expect(sortedGroups(d).map((g) => g.id)).toEqual(["g2", "g1"]);
    expect(sortedGroups(moveGroup(d, "g2", -1)).map((g) => g.id)).toEqual(["g2", "g1"]);
  });

  it("deletes a group keeping its entries as ungrouped", () => {
    let d = addEntry(withGroups(), input({ groupId: "g1" }), "e1", NOW);
    d = deleteGroup(d, "g1", "keepEntries");
    expect(d.groups.map((g) => g.id)).toEqual(["g2"]);
    expect(d.entries[0].groupId).toBeNull();
  });

  it("deletes a group with its entries", () => {
    let d = addEntry(withGroups(), input({ groupId: "g1" }), "e1", NOW);
    d = addEntry(d, input({ groupId: "g2", title: "HDFC" }), "e2", NOW);
    d = deleteGroup(d, "g1", "deleteEntries");
    expect(d.entries.map((e) => e.id)).toEqual(["e2"]);
  });
});

describe("filterEntries", () => {
  let d = addEntry(withGroups(), input({ groupId: "g1", title: "Instagram", loginLabel: "Insta ID", loginValue: "aryan.s" }), "e1", NOW);
  d = addEntry(d, input({ groupId: "g2", title: "HDFC (net)", loginLabel: "Username", loginValue: "cust01", password: "insta-pass", notes: "instagram backup" }), "e2", NOW);
  d = addEntry(d, input({ title: "Amazon" }), "e3", NOW);

  it("filters by group, with 'all' including ungrouped, sorted by title", () => {
    expect(filterEntries(d, "all", "").map((e) => e.id)).toEqual(["e3", "e2", "e1"]);
    expect(filterEntries(d, "g1", "").map((e) => e.id)).toEqual(["e1"]);
  });

  it("matches title, login label and login value case-insensitively", () => {
    expect(filterEntries(d, "all", "INSTA").map((e) => e.id)).toEqual(["e1"]);
    expect(filterEntries(d, "all", "cust").map((e) => e.id)).toEqual(["e2"]);
  });

  it("never matches passwords or notes", () => {
    expect(filterEntries(d, "all", "insta-pass")).toEqual([]);
    expect(filterEntries(d, "all", "backup")).toEqual([]);
  });

  it("treats special characters literally", () => {
    expect(filterEntries(d, "all", "(net)").map((e) => e.id)).toEqual(["e2"]);
    expect(filterEntries(d, "all", ".*")).toEqual([]);
  });
});
