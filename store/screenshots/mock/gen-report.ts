import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { renderChatReportHtml } from "D:/Desktop/Finzz/worktrees/server/account-deletion/src/services/chatReport/template.ts";
import { buildInsights } from "D:/Desktop/Finzz/worktrees/server/account-deletion/src/services/chatReport/insights.ts";

// Rohan Mehta chat (DEMO.md), viewer = Aarav. gave = Aarav paid.
const rows: [string, string, number, "gave" | "received", "verified" | "pending", "me" | "friend"][] = [
  ["2026-11-02", "Groceries", 1320, "gave", "verified", "me"],
  ["2026-11-06", "Coffee and snacks", 480, "received", "verified", "friend"],
  ["2026-11-09", "Concert tickets", 3000, "gave", "pending", "me"],
  ["2026-11-11", "Auto fare", 220, "received", "pending", "friend"],
];
const OPENING = 1850 - 700 + 640 - 1200 + 950 - 6500; // -4960
let running = OPENING, gave = 0, received = 0, addedByMe = 0, addedByFriend = 0;
const daily = Array.from({ length: 30 }, (_, i) => ({ dayOfMonth: i + 1, gave: 0, received: 0, count: 0 }));
const weekday = Array.from({ length: 7 }, (_, i) => ({ weekday: i, amount: 0, count: 0 }));
const ledger = rows.map(([day, remarks, amount, direction, status, addedBy], i) => {
  const d = new Date(day + "T00:00:00Z");
  const dom = d.getUTCDate();
  if (direction === "gave") { gave += amount; running += amount; daily[dom - 1].gave += amount; }
  else { received += amount; running -= amount; daily[dom - 1].received += amount; }
  daily[dom - 1].count++;
  weekday[d.getUTCDay()].amount += amount; weekday[d.getUTCDay()].count++;
  if (addedBy === "me") addedByMe++; else addedByFriend++;
  return { id: "r" + i, day, dayOfMonth: dom, weekday: d.getUTCDay(), remarks, amount, direction, status, addedBy, runningBalance: running };
});
const pend = rows.filter((r) => r[4] === "pending");
const data: any = {
  generatedAtUtc: "2026-11-13T04:30:00.000Z",
  period: { year: 2026, month: 11, label: "November 2026", startUtc: "2026-10-31T18:30:00.000Z", endUtc: "2026-11-30T18:30:00.000Z", daysInMonth: 30, tzOffsetMinutes: 330 },
  me: { id: "u1", name: "Aarav Kapoor" },
  friend: { id: "u2", name: "Rohan Mehta" },
  openingBalance: OPENING,
  closingBalance: running,
  totals: { gave, received, net: received - gave, count: rows.length, activeDays: rows.length, addedByMe, addedByFriend },
  byStatus: {
    verified: { count: 2, amount: 1320 + 480 },
    pending: { count: 2, amount: pend.reduce((s, r) => s + r[2], 0) },
    rejected: { count: 0, amount: 0 },
  },
  ledger, daily, weekday,
  previousMonth: { gave: 3440, received: 8400, net: 4960, count: 6 },
  trend: [
    ...["Jun", "Jul", "Aug", "Sep"].map((label, i) => ({ year: 2026, month: 6 + i, label, gave: 0, received: 0, net: 0 })),
    { year: 2026, month: 10, label: "Oct", gave: 3440, received: 8400, net: 4960 },
    { year: 2026, month: 11, label: "Nov", gave, received, net: received - gave },
  ],
};
const html = renderChatReportHtml(data, buildInsights(data));
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "report-demo.html"), html);
console.log("ok", html.length, "closing", running);
