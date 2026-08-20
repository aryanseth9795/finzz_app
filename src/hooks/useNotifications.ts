import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { updatePushTokenApi } from "../api/authApi";
import { useAppSelector } from "../store";
import { routeNotification } from "../navigation/navigationRef";

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

    void registerForPushNotificationsAsync();

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {
        // Presentation is handled by the notification handler above; nothing
        // to do here beyond keeping the subscription alive.
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        // Was a stub that logged and returned, so tapping a notification did
        // nothing. Routing now happens via the navigation ref.
        routeNotification(
          response.notification.request.content.data as Record<string, unknown>,
        );
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);

  /**
   * Handle a notification that launched the app from a cold start.
   *
   * `addNotificationResponseReceivedListener` does not fire for the tap that
   * started the process, so without this the deep link is lost precisely when
   * the user most clearly expressed intent.
   */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        routeNotification(
          response.notification.request.content.data as Record<string, unknown>,
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [userId]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

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

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus === "undetermined") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    /**
     * Silent when denied.
     *
     * The previous version showed an Alert with an "Open Settings" button
     * every time the app launched with notifications disabled — nagging the
     * user for a choice they had already made. Permission is now requested
     * once (only when `undetermined`); prompting to re-enable belongs on the
     * notifications screen, where the user went looking for it.
     */
    if (finalStatus !== "granted") return null;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;

    await updatePushTokenApi(token);
    return token;
  } catch {
    // Push registration failing must never break app startup.
    return null;
  }
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
