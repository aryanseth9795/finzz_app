import { Linking } from "react-native";
import { isPlayStoreUrl, toMarketUrl } from "./storeLink";

/** Opens the Play app for Play links (browser fallback), else the URL as-is. */
export const openUpdateLink = async (url: string): Promise<void> => {
  if (isPlayStoreUrl(url)) {
    try {
      await Linking.openURL(toMarketUrl(url)!);
      return;
    } catch {
      // Play app unavailable: fall through to the https link.
    }
  }
  await Linking.openURL(url);
};
