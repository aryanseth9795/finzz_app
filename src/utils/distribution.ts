import * as Updates from "expo-updates";

/** Native-embedded EAS channel ("play" for Play builds); null if unavailable. */
export const updateChannel = (): string | null => {
  try {
    return Updates.channel ?? null;
  } catch {
    return null;
  }
};
