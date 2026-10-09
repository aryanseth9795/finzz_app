import { describe, it, expect } from "vitest";
import { createClipboardGuard } from "./clipboardGuard";

const fake = () => {
  const clip = { value: "", readable: true };
  return {
    clip,
    api: {
      setStringAsync: async (s: string) => {
        clip.value = s;
      },
      getStringAsync: async () => (clip.readable ? clip.value : ""),
    },
  };
};

describe("clipboard guard", () => {
  it("clears on return to the app once 30 s have passed (timers do not run in background)", async () => {
    const { clip, api } = fake();
    let now = 0;
    const g = createClipboardGuard(api, { now: () => now, schedule: () => 0, cancel: () => undefined });
    await g.copy("hunter2");
    now = 31_000;
    await g.onAppActive();
    expect(clip.value).toBe("");
  });

  it("does not clear early on return", async () => {
    const { clip, api } = fake();
    let now = 0;
    const g = createClipboardGuard(api, { now: () => now, schedule: () => 0, cancel: () => undefined });
    await g.copy("hunter2");
    now = 5_000;
    await g.onAppActive();
    expect(clip.value).toBe("hunter2");
  });

  it("never wipes something else the user copied later", async () => {
    const { clip, api } = fake();
    let now = 0;
    const g = createClipboardGuard(api, { now: () => now, schedule: () => 0, cancel: () => undefined });
    await g.copy("hunter2");
    clip.value = "my own text";
    now = 31_000;
    await g.onAppActive();
    expect(clip.value).toBe("my own text");
  });

  it("clears when the scheduled timer fires", async () => {
    const { clip, api } = fake();
    let fire: (() => void) | null = null;
    const g = createClipboardGuard(api, {
      now: () => 0,
      schedule: (fn) => {
        fire = fn;
        return 0;
      },
      cancel: () => undefined,
    });
    await g.copy("hunter2");
    await (fire as unknown as () => Promise<void>)();
    expect(clip.value).toBe("");
  });
});
