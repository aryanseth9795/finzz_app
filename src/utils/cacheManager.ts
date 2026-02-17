import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHE_DURATION } from "../constants/api";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_PREFIX = "@finzz_cache_";

export const cacheManager = {
  /**
   * Get cached data if it exists and hasn't expired
   */
  get: async <T>(key: string, maxAge?: number): Promise<T | null> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      const age = Date.now() - entry.timestamp;
      const duration = maxAge ?? CACHE_DURATION.CHATS;

      if (age > duration) {
        // Cache expired
        await AsyncStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  },

  /**
   * Store data in cache with current timestamp
   */
  set: async <T>(key: string, data: T): Promise<void> => {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // Silently fail - cache is not critical
    }
  },

  /**
   * Remove specific cache entry
   */
  remove: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
    } catch {
      // Silently fail
    }
  },

  /**
   * Clear all app cache
   */
  clearAll: async (): Promise<void> => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch {
      // Silently fail
    }
  },
};

// Cache key helpers
export const CACHE_KEYS = {
  CHATS: "chats",
  TRANSACTIONS: (chatId: string) => `txns_${chatId}`,
  FRIENDS: "friends",
  PROFILE: "profile",
  CHAT_STATS: (chatId: string) => `stats_${chatId}`,
  FRIEND_REQUESTS: "friend_requests",
  EXPENSES: (ledgerId: string) => `expenses_${ledgerId}`,
  EXPENSE_LEDGERS: "expense_ledgers",
  EXPENSE_STATS: "expense_stats",
};
