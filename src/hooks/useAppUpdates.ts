import { useEffect } from "react";
import * as Updates from "expo-updates";
import { Alert, Platform } from "react-native";

export function useAppUpdates() {
  useEffect(() => {
    // Skip update checks in development
    if (__DEV__) {
      console.log("Skipping OTA update check in development mode");
      return;
    }

    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      console.log("Checking for OTA updates...");

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        console.log("Update available, fetching...");

        await Updates.fetchUpdateAsync();

        // Show alert to restart app
        Alert.alert(
          "Update Available",
          "A new version of the app has been downloaded. Would you like to restart now to apply the update?",
          [
            {
              text: "Later",
              style: "cancel",
            },
            {
              text: "Restart Now",
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
          ],
        );
      } else {
        console.log("App is up to date");
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
      // Silently fail - don't bother the user with update errors
    }
  }
}
