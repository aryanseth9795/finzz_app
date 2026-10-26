import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { reportPushStatusApi, updatePushTokenApi } from "../api/authApi";
import { useAppSelector } from "../store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  routeNotification,
  waitForNavigation,
} from "../navigation/navigationRef";
import { isNewLaunchResponse } from "../utils/notificationRoute";
import { logger } from "../utils/logger";
import {
  describeOutcome,
  isValidExpoToken,
  shouldIgnoreRotation,
  shouldReportOutcome,
  shouldUploadToken,
  type PushRegistrationOutcome,
} from "../utils/pushRegistration";

/** Identifier of the last notification tap already routed. */
const LAST_HANDLED_KEY = "@finzz_last_handled_notification";

/**
 * Route a tap at most once, whichever path delivers it (live listener or the
 * cold-start lookup), and remember it so later launches do not replay it.
 */
const handleResponse = async (response: Notifications.NotificationResponse) => {
  const id = response.notification.request.identifier;
  const lastHandled = await AsyncStorage.getItem(LAST_HANDLED_KEY).catch(
    () => null,
  );
  if (!isNewLaunchResponse(id, lastHandled)) return;
  await AsyncStorage.setItem(LAST_HANDLED_KEY, id).catch(() => undefined);
  await waitForNavigation();
  routeNotification(
    response.notification.request.content.data as Record<string, unknown>,
  );
};

/**
 * Foreground presentation.
 *
 * SDK 54 replaced `shouldShowAlert` with `shouldShowBanner`/`shouldShowList`.
 * The previous object still used the old key and was cast with
 * `as Notifications.NotificationBehavior` — silencing the compiler error that
 * would have flagged it, so foreground notifications may simply not have
 * displayed.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Expo project id, needed for token issuance in EAS builds. */
const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ??
  (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;

/**
 * Registration bookkeeping. Deliberately NOT under the `@finzz_cache_` prefix
 * (see cacheManager), so a cache clear does not make the device forget what
 * it already told the server. The user key stops account B on a shared device
 * from being skipped as "unchanged" because account A uploaded the same token.
 */
const LAST_TOKEN_KEY = "@finzz_push_token_last";
const LAST_AT_KEY = "@finzz_push_token_at";
const LAST_USER_KEY = "@finzz_push_token_user";

/** Foreground re-registration is throttled to once per this window. */
const FOREGROUND_THROTTLE_MS = 10 * 60 * 1000;

let lastForegroundRunAt = 0;
let askedAgainThisSession = false;

/** The shared registration run: one per user, so accounts never share a result. */
interface InFlightRun {
  userId: string;
  force: boolean;
  promise: Promise<PushRegistrationOutcome>;
}
let inFlight: InFlightRun | null = null;

/** When the last run settled (0 = none yet); drives the rotation debounce. */
let lastRunCompletedAt = 0;

/** Outcomes already reported to the server this app session. */
const reportedOutcomes = new Set<PushRegistrationOutcome>();
/** Error text of the latest non-success outcome (runs are serialized). */
let lastDetail: string | undefined;

/** Upper bound on how long sign-out waits for a registration run. */
const IDLE_WAIT_TIMEOUT_MS = 8000;

export function useNotifications() {
  // Depend on the ID, not the object.
  //
  // The effect previously depended on `[user]` — the whole Redux object — so
  // every `setCredentials`, `updateUser` and `updateAvatar` changed its
  // identity and re-ran the entire registration: a permission check, a token
  // fetch and a POST, plus re-subscribing both listeners.
  const userId = useAppSelector((state) => state.auth.user?._id);

  const notificationListener = useRef<Notifications.Subscription | undefined>(
    undefined,
  );
  const responseListener = useRef<Notifications.Subscription | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!userId) return;

    // The initial run counts as a foreground run, so an immediate "active"
    // event does not start a second one.
    lastForegroundRunAt = Date.now();
    void registerForPushNotificationsAsync(userId);

    // Re-run when the app returns to the foreground (throttled): picks up a
    // permission granted in system settings and heals a missing/pruned token.
    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const now = Date.now();
      if (now - lastForegroundRunAt < FOREGROUND_THROTTLE_MS) return;
      lastForegroundRunAt = now;
      void registerForPushNotificationsAsync(userId);
    });

    // The device token rotated (FCM refresh): fetch the Expo token again and
    // upload it. Not throttled and never skipped as "unchanged" (the token
    // really changed); duplicate events right after a run are dropped.
    const tokenSub = Notifications.addPushTokenListener(() => {
      if (shouldIgnoreRotation(lastRunCompletedAt, Date.now())) return;
      void registerForPushNotificationsAsync(userId, { force: true });
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {
        // Presentation is handled by the notification handler above; nothing
        // to do here beyond keeping the subscription alive.
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        // Was a stub that logged and returned, so tapping a notification did
        // nothing. Routing now happens via the navigation ref.
        void handleResponse(response);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      appStateSub.remove();
      tokenSub.remove();
    };
  }, [userId]);

  /**
   * Handle a notification that launched the app from a cold start.
   *
   * `addNotificationResponseReceivedListener` does not fire for the tap that
   * started the process, so without this the deep link is lost precisely when
   * the user most clearly expressed intent.
   *
   * But the "last response" persists: it was returned on EVERY later launch
   * too, replaying an old tap — and since admin broadcasts routed to the
   * Expenses tab, the app kept opening there. Each tap is now handled once
   * (by identifier) and the stored response is cleared after use.
   */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        Notifications.clearLastNotificationResponse();
        return handleResponse(response);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [userId]);
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Log a non-success outcome; "registered"/"unchanged" are the happy paths. */
const report = (
  outcome: PushRegistrationOutcome,
  error?: unknown,
): PushRegistrationOutcome => {
  if (outcome !== "registered" && outcome !== "unchanged") {
    lastDetail = error === undefined ? undefined : errMsg(error);
    logger.warn(
      `[push] ${outcome}: ${describeOutcome(outcome)}`,
      error === undefined ? "" : errMsg(error),
    );
  }
  return outcome;
};

/**
 * Forget what was uploaded, so the next sign-in always uploads. Call on
 * sign-out (AccountScreen), alongside the server-side token removal.
 */
export async function clearPushRegistrationState(): Promise<void> {
  await AsyncStorage.multiRemove([
    LAST_TOKEN_KEY,
    LAST_AT_KEY,
    LAST_USER_KEY,
  ]).catch(() => undefined);
}

/**
 * Tell the server how registration ended, best effort. Once per outcome per
 * app session; failures are ignored.
 */
function reportToServer(outcome: PushRegistrationOutcome): void {
  if (!shouldReportOutcome(reportedOutcomes, outcome)) return;
  const detail = outcome === "registered" ? undefined : lastDetail;
  void Promise.resolve()
    .then(() => reportPushStatusApi(outcome, detail?.slice(0, 200)))
    .catch(() => undefined);
}

/**
 * Concurrent triggers (login + foreground + rotation) for the same user share
 * one run. A different user (or a forced run while a normal one is in
 * flight, which may already have read the old token) starts a fresh run once
 * the current one settles.
 */
export function registerForPushNotificationsAsync(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<PushRegistrationOutcome> {
  const force = opts.force === true;
  const current = inFlight;
  if (current && current.userId === userId && (current.force || !force)) {
    return current.promise;
  }

  const start = (): Promise<PushRegistrationOutcome> => {
    lastDetail = undefined;
    return runRegistration(userId, force).catch((e) =>
      report("token-error", e),
    );
  };
  const promise: Promise<PushRegistrationOutcome> = (
    current ? current.promise.then(start, start) : start()
  )
    .then((outcome) => {
      reportToServer(outcome);
      return outcome;
    })
    .finally(() => {
      lastRunCompletedAt = Date.now();
      if (inFlight === run) inFlight = null;
    });
  const run: InFlightRun = { userId, force, promise };
  inFlight = run;
  return promise;
}

/**
 * Resolves once no registration run is in flight (or after a short timeout,
 * so sign-out is never stuck behind a hung token fetch). Await before sign-out
 * so a late upload cannot re-attach the token to the signed-out account.
 */
export async function waitForPushRegistrationIdle(
  timeoutMs: number = IDLE_WAIT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (inFlight) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, remaining);
    });
    const settled = inFlight.promise.then(
      () => undefined,
      () => undefined,
    );
    await Promise.race([settled, timeout]);
    if (timer) clearTimeout(timer);
  }
}

async function runRegistration(
  userId: string,
  force: boolean,
): Promise<PushRegistrationOutcome> {
  if (!Device.isDevice) return report("not-a-device");

  // Create the Android channel BEFORE requesting a token, so the first
  // notification already has an importance level to be delivered under.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#007AFF",
    });
  }

  let perm = await Notifications.getPermissionsAsync();
  if (perm.status === "undetermined") {
    // Android 13 can report "denied" + canAskAgain right after the user
    // declines this prompt; count it so we do not ask again this session.
    askedAgainThisSession = true;
    perm = await Notifications.requestPermissionsAsync();
  } else if (
    perm.status === "denied" &&
    perm.canAskAgain &&
    !askedAgainThisSession
  ) {
    // Android lets us ask again until the user picks "don't ask again".
    // Once per app session, so this is never a nag loop.
    askedAgainThisSession = true;
    perm = await Notifications.requestPermissionsAsync();
  }
  if (perm.status !== "granted") return report("permission-denied");

  if (!projectId) return report("no-project-id");

  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenData.data;
  } catch (e) {
    return report("token-error", e);
  }
  if (!isValidExpoToken(token)) {
    return report("token-error", new Error("Malformed Expo push token"));
  }

  const [[, lastToken], [, lastAtRaw], [, lastUser]] =
    await AsyncStorage.multiGet([LAST_TOKEN_KEY, LAST_AT_KEY, LAST_USER_KEY]);
  const lastAt = lastAtRaw ? Number(lastAtRaw) : null;
  // A different account on this device must upload even for the same token.
  const sameUser = lastUser === userId;

  const now = Date.now();
  if (
    !force &&
    !shouldUploadToken(
      token,
      sameUser ? lastToken : null,
      sameUser ? lastAt : null,
      now,
    )
  ) {
    return "unchanged";
  }

  try {
    await updatePushTokenApi(token);
  } catch (e) {
    // Old stored values are kept, so the next trigger retries.
    return report("upload-error", e);
  }

  await AsyncStorage.multiSet([
    [LAST_TOKEN_KEY, token],
    [LAST_AT_KEY, String(now)],
    [LAST_USER_KEY, userId],
  ]).catch((e) =>
    logger.warn("[push] could not persist upload state", errMsg(e)),
  );
  return "registered";
}

/** The device's current Expo push token, for de-registration on sign-out. */
export async function getCurrentPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return null;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData.data;
  } catch {
    return null;
  }
}
