import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform, Alert, Linking } from "react-native";
import { updatePushTokenApi } from "../api/authApi";
import { useAppSelector } from "../store";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }) as Notifications.NotificationBehavior,
});

export function useNotifications() {
  const { user } = useAppSelector((state) => state.auth);
  const notificationListener = useRef<Notifications.Subscription | undefined>(
    undefined,
  );
  const responseListener = useRef<Notifications.Subscription | undefined>(
    undefined,
  );

  useEffect(() => {
    // Only register if user is authenticated
    if (!user) return;

    registerForPushNotificationsAsync();

    // Listener for notifications received while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
        // You can add custom handling here (e.g., play sound, show badge)
      });

    // Listener for when user taps on a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification tapped:", response);
        const data = response.notification.request.content.data;

        // Handle navigation based on notification type
        handleNotificationTap(data);
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);
}

async function registerForPushNotificationsAsync() {
  try {
    // Check if running on physical device
    if (!Device.isDevice) {
      console.log("Push notifications only work on physical devices");
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    // If not granted (undetermined or denied), show explanation popup first
    if (existingStatus !== "granted") {
      // Create a promise to handle the user's choice from the Alert
      const userChoseToEnable = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Enable Notifications",
          "Finzz needs notifications to send you real-time updates about your transactions and friend requests.",
          [
            {
              text: "Not Now",
              style: "cancel",
              onPress: () => resolve(false),
            },
            {
              text: "Enable",
              onPress: () => resolve(true),
            },
          ],
        );
      });

      if (!userChoseToEnable) {
        console.log("User cancelled notification permission request");
        return null;
      }

      // If user clicked Enable, request system permissions
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      Alert.alert(
        "Permission Required",
        "Push notifications are disabled. Please enable them in settings to receive updates.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
      return null;
    }

    // Get Expo push token (no projectId needed for development/EAS)
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    console.log("Expo Push Token:", token);

    // Upload token to backend
    await updatePushTokenApi(token);
    console.log("Push token uploaded to backend");

    // Android-specific channel setup
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    return token;
  } catch (error) {
    console.error("Error registering for push notifications:", error);
    return null;
  }
}

function handleNotificationTap(data: any) {
  // Handle navigation based on notification type
  // You'll need to implement navigation logic here based on your app structure
  console.log("Handle notification tap with data:", data);

  // Example navigation logic (you'll need to adapt this to your navigation setup):
  // if (data?.type === 'txn_added' || data?.type === 'txn_verified') {
  //   navigationRef.navigate('ChatScreen', { chatId: data.chatId });
  // } else if (data?.type === 'friend_request' || data?.type === 'friend_accepted') {
  //   navigationRef.navigate('AddFriend');
  // }
}
