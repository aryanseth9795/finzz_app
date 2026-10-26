import * as Crypto from "expo-crypto";
import type { RandomBytes } from "./crypto";

/** Native CSPRNG. Never Math.random for anything in the vault. */
export const randomBytes: RandomBytes = (n) => Crypto.getRandomBytes(n);
