import type { AppDispatch } from "../store";
import { logout as logoutAction } from "../store/slices/authSlice";
import { logoutApi } from "../api/authApi";
import { tokenManager } from "../utils/tokenManager";
import { cacheManager } from "../utils/cacheManager";
import { resetCategorySync } from "../utils/expenseCategorySync";
import {
  clearPushRegistrationState,
  getCurrentPushToken,
  waitForPushRegistrationIdle,
} from "../hooks/useNotifications";

/**
 * Tell the server first, then clear locally.
 *
 * The server needs two things this device holds: the refresh token,
 * so it revokes only THIS device's grant rather than every session;
 * and the push token, so notifications for this account stop being
 * delivered here. Without the second, the device kept receiving the
 * previous user's transaction notifications — including counterparty
 * names and amounts — after somebody else signed in.
 *
 * The local teardown runs regardless: if the network call fails the
 * user must still end up signed out on this device, and the server
 * grant expires on its own.
 *
 * Account deletion passes `notifyServer: false`: the server already removed
 * the account and every grant, so there is nothing left to revoke.
 */
export const signOutOnThisDevice = async (
  dispatch: AppDispatch,
  opts: { notifyServer: boolean },
) => {
  // First, so a category fetch still in flight cannot write after the wipe.
  resetCategorySync();

  // Let any in-flight push registration finish first, so a late upload
  // cannot re-attach this token to the account being signed out.
  await waitForPushRegistrationIdle();

  if (opts.notifyServer) {
    const [refreshToken, pushToken] = await Promise.all([
      tokenManager.getRefreshToken(),
      getCurrentPushToken(),
    ]);

    try {
      await logoutApi({ refreshToken, pushToken });
    } catch {
      // Best effort — proceed with the local sign-out either way.
    }
  }

  // Forget the uploaded push token so the next sign-in re-uploads.
  // Must never block sign-out.
  try {
    await clearPushRegistrationState();
  } catch {
    // Ignore — local sign-out proceeds regardless.
  }

  // Again, for any category fetch started during the logout call above.
  resetCategorySync();
  await tokenManager.clearAll();
  await cacheManager.clearAll();
  // The root reducer resets every slice on this action, so the next
  // account cannot see the previous user's chats, balances or ledger.
  dispatch(logoutAction());
};
