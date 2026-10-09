/**
 * Forced-update decision logic.
 *
 * Kept free of Expo imports so it runs under vitest. The installed version is
 * supplied by the caller (`useForceUpdate`), which reads it from expo-updates.
 */

export interface AppRelease {
  latestVersion: string;
  minSupportedVersion: string;
  apkUrl: string;
  releaseNotes: string;
}

export type GateStatus = "blocked" | "optional" | "ok";

const SEMVER = /^\d+\.\d+\.\d+$/;

export const isValidVersion = (v: unknown): v is string =>
  typeof v === "string" && SEMVER.test(v);

/** -1 if a < b, 0 if equal, 1 if a > b. Numeric per segment: 1.10.0 > 1.9.0. */
export const compareVersions = (a: string, b: string): -1 | 0 | 1 => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
};

/**
 * Accept only a release whose versions are valid. Anything else is treated
 * as "no requirement": a bad server value must never lock users out.
 */
export const parseRelease = (raw: unknown): AppRelease | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    !isValidVersion(r.latestVersion) ||
    !isValidVersion(r.minSupportedVersion)
  ) {
    return null;
  }
  return {
    latestVersion: r.latestVersion,
    minSupportedVersion: r.minSupportedVersion,
    apkUrl: typeof r.apkUrl === "string" ? r.apkUrl : "",
    releaseNotes: typeof r.releaseNotes === "string" ? r.releaseNotes : "",
  };
};

export const decideGate = (
  installed: string,
  release: AppRelease | null,
  cached: AppRelease | null,
): { status: GateStatus; release: AppRelease | null } => {
  const effective = release ?? cached;
  if (!effective || !isValidVersion(installed)) {
    return { status: "ok", release: effective };
  }
  if (compareVersions(installed, effective.minSupportedVersion) < 0) {
    return { status: "blocked", release: effective };
  }
  if (compareVersions(installed, effective.latestVersion) < 0) {
    return { status: "optional", release: effective };
  }
  return { status: "ok", release: effective };
};
