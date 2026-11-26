/**
 * "How Finzz works" content (T-027).
 *
 * Slides are the Play Store screenshots (store/screenshots/out), re-encoded to
 * 720x1280 JPEG by scripts/make-onboarding-assets.py and bundled with the
 * update. Videos are NOT bundled: they stream from the website only when the
 * user taps Play, so the OTA stays small and nobody pays for data they don't use.
 */
import type { ImageSourcePropType } from "react-native";
import { siteUrlCandidates } from "../utils/siteLinks";

export interface OnboardingSlide {
  key: string;
  /** Screen-reader text; the headline is baked into the image. */
  label: string;
  image: ImageSourcePropType;
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  { key: "chats", label: "Your friend ledgers in one place", image: require("../../assets/onboarding/01-chats.jpg") },
  { key: "ledger", label: "Every entry verified by both sides", image: require("../../assets/onboarding/02-ledger.jpg") },
  { key: "report", label: "Share a clean monthly report", image: require("../../assets/onboarding/03-report.jpg") },
  { key: "expenses", label: "Track your own spending", image: require("../../assets/onboarding/04-expenses.jpg") },
  { key: "analytics", label: "See where your money went", image: require("../../assets/onboarding/05-analytics.jpg") },
  { key: "notes", label: "Notes you can share with friends", image: require("../../assets/onboarding/06-notes.jpg") },
  { key: "pools", label: "Split group expenses in pools", image: require("../../assets/onboarding/07-pools.jpg") },
  { key: "vault", label: "A private password vault on your phone", image: require("../../assets/onboarding/08-vault.jpg") },
];

export type OnboardingVideoId =
  | "teaser"
  | "promo"
  | "story-hindi"
  | "friends-pools"
  | "expenses"
  | "vault-notes";

export interface OnboardingVideo {
  id: OnboardingVideoId;
  title: string;
  subtitle: string;
  durationLabel: string;
  /** Approximate download size, shown so users on mobile data can decide. */
  sizeLabel: string;
  /** Candidate URLs, primary host first; the player falls back down the list. */
  urls: readonly string[];
  poster: ImageSourcePropType;
}

const video = (file: string): readonly string[] => siteUrlCandidates(`/videos/${file}`);

export const ONBOARDING_VIDEOS: readonly OnboardingVideo[] = [
  { id: "teaser", title: "Finzz in 15 seconds", subtitle: "The quick tour", durationLabel: "0:15", sizeLabel: "2 MB", urls: video("finzz-teaser-9x16.mp4"), poster: require("../../assets/onboarding/video-teaser.jpg") },
  { id: "story-hindi", title: "Rohan aur Akash ki kahani", subtitle: "Hindi story · why Finzz", durationLabel: "1:22", sizeLabel: "28 MB", urls: video("finzz-story-hindi-9x16.mp4"), poster: require("../../assets/onboarding/video-story-hindi.jpg") },
  { id: "promo", title: "Everything Finzz does", subtitle: "Full walkthrough", durationLabel: "1:00", sizeLabel: "7 MB", urls: video("finzz-promo-9x16.mp4"), poster: require("../../assets/onboarding/video-promo.jpg") },
  { id: "friends-pools", title: "Friends and pools", subtitle: "Shared ledgers and group splits", durationLabel: "0:38", sizeLabel: "4 MB", urls: video("finzz-v1-friends-pools-9x16.mp4"), poster: require("../../assets/onboarding/video-friends-pools.jpg") },
  { id: "expenses", title: "Expenses and analytics", subtitle: "Track and understand spending", durationLabel: "0:37", sizeLabel: "4 MB", urls: video("finzz-v2-expenses-9x16.mp4"), poster: require("../../assets/onboarding/video-expenses.jpg") },
  { id: "vault-notes", title: "Vault and notes", subtitle: "Private passwords, shared notes", durationLabel: "0:34", sizeLabel: "4 MB", urls: video("finzz-v3-vault-notes-9x16.mp4"), poster: require("../../assets/onboarding/video-vault-notes.jpg") },
];

export const findOnboardingVideo = (id: string): OnboardingVideo | undefined =>
  ONBOARDING_VIDEOS.find((v) => v.id === id);
