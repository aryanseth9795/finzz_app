import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * T-026 guard: the app uses the themed toast (useToast) and dialog (useDialog),
 * never the grey system Alert. This fails if a native Alert call comes back.
 */
const SRC = join(__dirname, "..");
const ROOT_FILES = [join(SRC, "..", "App.tsx")];
const PATTERN = /\bAlert\s*\.\s*(alert|prompt)\s*\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

describe("no native alerts", () => {
  it("has no Alert.alert or Alert.prompt in app code", () => {
    const offenders: string[] = [];
    for (const file of [...walk(SRC), ...ROOT_FILES]) {
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (PATTERN.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
            offenders.push(`${relative(join(SRC, ".."), file)}:${i + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
