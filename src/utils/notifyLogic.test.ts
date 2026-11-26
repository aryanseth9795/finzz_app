import { describe, expect, it } from "vitest";
import {
  TOAST_DURATION_MS,
  pushHost,
  removeHost,
  topHost,
  normalizeActions,
  dismissPlan,
  layoutActions,
  dialogTone,
} from "./notifyLogic";

describe("toast durations", () => {
  it("gives errors and warnings longer than confirmations", () => {
    expect(TOAST_DURATION_MS.success).toBeLessThan(TOAST_DURATION_MS.info);
    expect(TOAST_DURATION_MS.info).toBeLessThan(TOAST_DURATION_MS.error);
    expect(TOAST_DURATION_MS.warning).toBe(TOAST_DURATION_MS.error);
  });
});

describe("toast host stack", () => {
  it("shows the toast in the most recently mounted host", () => {
    let s = pushHost([], "root");
    s = pushHost(s, "modal");
    expect(topHost(s)).toBe("modal");
    s = removeHost(s, "modal");
    expect(topHost(s)).toBe("root");
  });

  it("removes a host from the middle without disturbing the top", () => {
    const s = removeHost(["root", "a", "b"], "a");
    expect(s).toEqual(["root", "b"]);
    expect(topHost(s)).toBe("b");
  });

  it("does not duplicate a host that mounts twice", () => {
    expect(pushHost(["root", "a"], "a")).toEqual(["root", "a"]);
  });

  it("has no top when empty", () => {
    expect(topHost([])).toBeUndefined();
  });
});

describe("dialog actions", () => {
  it("defaults to a single OK", () => {
    expect(normalizeActions(undefined)).toEqual([{ label: "OK", style: "default" }]);
    expect(normalizeActions([])).toEqual([{ label: "OK", style: "default" }]);
  });

  it("keeps the given actions and fills in the style", () => {
    const a = normalizeActions([{ label: "Cancel", style: "cancel" }, { label: "Go" }]);
    expect(a.map((x) => x.style)).toEqual(["cancel", "default"]);
  });

  it("back and backdrop run the cancel action when there is one", () => {
    const p = dismissPlan(
      normalizeActions([{ label: "Delete", style: "destructive" }, { label: "Cancel", style: "cancel" }]),
    );
    expect(p).toEqual({ backIndex: 1, backdropIndex: 1 });
  });

  it("a one-button acknowledgement closes on back but not on a stray backdrop tap", () => {
    expect(dismissPlan(normalizeActions(undefined))).toEqual({ backIndex: 0, backdropIndex: null });
  });

  it("a choice with no cancel can't be dismissed by accident", () => {
    const p = dismissPlan(normalizeActions([{ label: "A" }, { label: "B" }]));
    expect(p).toEqual({ backIndex: null, backdropIndex: null });
  });

  it("lays two actions in a row with cancel first", () => {
    const acts = normalizeActions([{ label: "Delete", style: "destructive" }, { label: "Cancel", style: "cancel" }]);
    const l = layoutActions(acts);
    expect(l.direction).toBe("row");
    expect(l.order.map((i) => acts[i].label)).toEqual(["Cancel", "Delete"]);
  });

  it("stacks three or more actions with cancel last", () => {
    const acts = normalizeActions([
      { label: "Cancel", style: "cancel" },
      { label: "Edit" },
      { label: "Delete", style: "destructive" },
    ]);
    const l = layoutActions(acts);
    expect(l.direction).toBe("column");
    expect(l.order.map((i) => acts[i].label)).toEqual(["Edit", "Delete", "Cancel"]);
  });

  it("picks the destructive tone when any action is destructive", () => {
    expect(dialogTone(normalizeActions([{ label: "Leave", style: "destructive" }]))).toBe("destructive");
    expect(dialogTone(normalizeActions(undefined))).toBe("default");
    expect(dialogTone(normalizeActions(undefined), "warning")).toBe("warning");
  });
});
