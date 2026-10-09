import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { getAppVersionApi } from "../api/appApi";
import { withTimeout } from "../utils/async";
import {
  AppRelease,
  GateStatus,
  decideGate,
  nextOptionalPrompt,
  parseRelease,
} from "../utils/version";

const RELEASE_KEY = "@finzz_app_release";
const DISMISS_PREFIX = "@finzz_update_dismissed_";
/** Upper bound on the launch-time cache read before deciding without it. */
const CACHE_READ_TIMEOUT_MS = 2000;

/** Never lock a developer out of their own dev build unless they opt in. */
const ENABLED = !__DEV__ || process.env.EXPO_PUBLIC_FORCE_UPDATE_DEV === "1";

/**
 * The installed NATIVE build. runtimeVersion follows app.json `version`
 * (policy "appVersion") and is baked into the binary, so an OTA update cannot
 * change it — which is exactly what a forced APK update must compare against.
 */
const getInstalledVersion = (): string =>
  Updates.runtimeVersion ?? Constants.expoConfig?.version ?? "0.0.0";

const readCached = async (): Promise<AppRelease | null> => {
  try {
    const raw = await AsyncStorage.getItem(RELEASE_KEY);
    return raw ? parseRelease(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export function useForceUpdate() {
  const installedVersion = useRef(getInstalledVersion()).current;
  const [status, setStatus] = useState<GateStatus | "checking">(
    ENABLED ? "checking" : "ok",
  );
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [optionalVersion, setOptionalVersion] = useState<string | null>(null);
  const cached = useRef<AppRelease | null>(null);
  const inFlight = useRef(false);
  // The version already prompted for this session. Refetches create a new
  // release object for the same version and must not prompt again.
  const shownVersion = useRef<string | null>(null);

  const apply = useCallback(
    async (fresh: AppRelease | null) => {
      const gate = decideGate(installedVersion, fresh, cached.current);
      setStatus(gate.status);
      setRelease(gate.release);
      if (gate.status === "optional" && gate.release) {
        const dismissed = await AsyncStorage.getItem(
          DISMISS_PREFIX + gate.release.latestVersion,
        ).catch(() => null);
        // Checked and recorded synchronously after the await, so two
        // overlapping applies cannot both prompt.
        const next = nextOptionalPrompt(
          gate.status,
          gate.release,
          shownVersion.current,
          !!dismissed,
        );
        if (next) {
          shownVersion.current = next;
          setOptionalVersion(next);
        }
      } else {
        setOptionalVersion(null);
      }
    },
    [installedVersion],
  );

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await getAppVersionApi();
      const fresh = parseRelease(res.data?.release);
      if (fresh) {
        cached.current = fresh;
        await AsyncStorage.setItem(RELEASE_KEY, JSON.stringify(fresh)).catch(
          () => undefined,
        );
      }
      await apply(fresh);
    } catch {
      // Offline or server down: decide from the last known release.
      await apply(null);
    } finally {
      inFlight.current = false;
    }
  }, [apply]);

  useEffect(() => {
    if (!ENABLED) return;
    let cancelled = false;

    // Decide from cache first so a blocked install stays blocked offline and
    // an allowed one is not held behind a network round trip.
    // Bounded: a hung storage call must not hold the app on the splash.
    void withTimeout(readCached(), CACHE_READ_TIMEOUT_MS, null).then(async (c) => {
      if (cancelled) return;
      cached.current = c;
      await apply(null);
      void check();
    });

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [apply, check]);

  const dismissOptional = useCallback(() => {
    setOptionalVersion((version) => {
      if (version) {
        void AsyncStorage.setItem(DISMISS_PREFIX + version, "1").catch(
          () => undefined,
        );
      }
      return null;
    });
  }, []);

  return {
    status,
    release,
    installedVersion,
    optionalVersion,
    dismissOptional,
  };
}
