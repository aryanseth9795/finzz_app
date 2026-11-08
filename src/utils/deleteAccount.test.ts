import { describe, it, expect } from "vitest";
import {
  DELETE_CONFIRM_WORD,
  canSubmitDeletion,
  deletionErrorMessage,
} from "./deleteAccount";

describe("canSubmitDeletion", () => {
  it("uses DELETE as the confirm word", () => {
    expect(DELETE_CONFIRM_WORD).toBe("DELETE");
  });
  it("accepts a password and the exact word", () => {
    expect(canSubmitDeletion("secret", "DELETE")).toBe(true);
  });
  it("accepts lowercase and space-padded input", () => {
    expect(canSubmitDeletion("secret", "delete")).toBe(true);
    expect(canSubmitDeletion("secret", "  Delete  ")).toBe(true);
  });
  it("rejects an empty password", () => {
    expect(canSubmitDeletion("", "DELETE")).toBe(false);
  });
  it("rejects a wrong or partial word", () => {
    expect(canSubmitDeletion("secret", "")).toBe(false);
    expect(canSubmitDeletion("secret", "DELET")).toBe(false);
    expect(canSubmitDeletion("secret", "DELETE ME")).toBe(false);
  });
});

describe("deletionErrorMessage", () => {
  it("maps 400 (wrong password)", () => {
    expect(deletionErrorMessage(400, "Incorrect password")).toBe(
      "That password isn't right.",
    );
  });
  it("maps 401 (expired session)", () => {
    expect(deletionErrorMessage(401, "Unauthorized")).toBe(
      "Your session has expired. Please sign in again.",
    );
  });
  it("maps 429", () => {
    expect(deletionErrorMessage(429)).toBe(
      "Too many attempts. Please wait a few minutes and try again.",
    );
  });
  it("maps a missing response", () => {
    expect(deletionErrorMessage(undefined, "ignored")).toBe(
      "Couldn't reach Finzz. Check your connection and try again.",
    );
  });
  it("uses the server message for other statuses", () => {
    expect(deletionErrorMessage(500, "Boom")).toBe("Boom");
  });
  it("falls back when there is no server message", () => {
    expect(deletionErrorMessage(500)).toBe(
      "Something went wrong. Your account was not deleted.",
    );
  });
});
