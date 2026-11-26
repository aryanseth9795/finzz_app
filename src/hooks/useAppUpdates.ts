import { useEffect } from "react";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import { useDialog } from "../contexts/DialogContext";

export function useAppUpdates() {
  const { showDialog } = useDialog();

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
        showDialog({
      dismissOnBackdrop: false,
          title: "Update Available",
          message:
            "A new version of the app has been downloaded. Would you like to restart now to apply the update?",
          actions: [
            { label: "Later", style: "cancel" },
            {
              label: "Restart Now",
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
          ],
        });
      } else {
        console.log("App is up to date");
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
      // Silently fail - don't bother the user with update errors
    }
  }
}
