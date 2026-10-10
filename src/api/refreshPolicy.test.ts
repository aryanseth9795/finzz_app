import { describe, it, expect } from "vitest";
import { shouldRefreshOn401 } from "./refreshPolicy";

/**
 * Bug: a wrong password on the login screen produced "Invalid phone number or
 * password" AND "Your session expired": the 401 from /users/login was treated
 * as an expired access token, a refresh was attempted, failed, and the
 * sign-out path fired with its toast.
 */
describe("shouldRefreshOn401", () => {
  it("never refreshes for credential endpoints, whose 401 means wrong credentials", () => {
    for (const url of [
      "/users/login",
      "/users/register",
      "/users/send-otp",
      "/users/verify-otp",
      "/users/forgot-password",
      "/users/reset-password",
      "/users/change-password",
      "/users/refresh",
    ]) {
      expect(shouldRefreshOn401(url, true)).toBe(false);
    }
  });

  it("never refreshes a request that carried no access token", () => {
    expect(shouldRefreshOn401("/expenses", false)).toBe(false);
  });

  it("refreshes an authenticated request to a normal endpoint", () => {
    expect(shouldRefreshOn401("/expenses", true)).toBe(true);
    expect(shouldRefreshOn401("/chats/abc/txns?cursor=x", true)).toBe(true);
  });

  it("handles a missing url", () => {
    expect(shouldRefreshOn401(undefined, true)).toBe(false);
  });
});
