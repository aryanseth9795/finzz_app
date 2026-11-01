import { describe, it, expect } from "vitest";
import reducer, {
  addExpense,
  updateExpense,
  setActiveLedger,
  setExpenses,
} from "./expenseSlice";
import type { IExpense, IExpenseLedger } from "../../types";

const ledger = (id: string, year: number, month: number): IExpenseLedger => ({
  _id: id,
  userId: "u1",
  year,
  month,
  status: "open",
  totalExpenses: 0,
  totalCredits: 0,
});

const NOV = ledger("nov", 2026, 11);
const OCT = ledger("oct", 2026, 10);

/** The fields that date an expense to `day` (stored at UTC midnight). */
const on = (day: string): Partial<IExpense> => {
  const date = `${day}T00:00:00.000Z`;
  return { date, createdAt: date, updatedAt: date };
};

const expense = (
  id: string,
  ledgerId: string,
  extra: Partial<IExpense> = {},
): IExpense => ({
  _id: id,
  userId: "u1",
  ledgerId,
  amount: 100,
  type: "debit",
  date: "2026-11-01T00:00:00.000Z",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...extra,
});

/**
 * The store with `active` on screen and `rows` already listed. Rows go in the
 * server's order: date, then _id, newest first.
 */
const stateWith = (
  active: IExpenseLedger | null,
  rows: IExpense[],
  hasMore = true,
) => {
  let state = reducer(undefined, { type: "@@init" });
  state = reducer(state, setActiveLedger(active));
  return reducer(
    state,
    setExpenses({ expenses: rows, nextCursor: "cursor-1", hasMore }),
  );
};

/** 31 / 20 / 12 Oct, as the server sends them. */
const octoberRows = () => [
  expense("a31", "oct", on("2026-10-31")),
  expense("a20", "oct", on("2026-10-20")),
  expense("a12", "oct", on("2026-10-12")),
];

const ids = (state: ReturnType<typeof reducer>) =>
  state.expenses.map((e) => e._id);

describe("addExpense", () => {
  it("puts a new row for the month on screen at the top", () => {
    const state = stateWith(NOV, [expense("a", "nov")]);
    const next = reducer(state, addExpense(expense("b", "nov")));
    expect(ids(next)).toEqual(["b", "a"]);
  });

  it("leaves the list alone when the expense went to another month", () => {
    const state = stateWith(NOV, [expense("a", "nov")]);
    const next = reducer(state, addExpense(expense("b", "oct")));
    expect(ids(next)).toEqual(["a"]);
  });

  it("puts the row at the top when no month is on screen yet", () => {
    const state = stateWith(null, []);
    const next = reducer(state, addExpense(expense("b", "nov")));
    expect(ids(next)).toEqual(["b"]);
  });

  it("does not list the same expense twice", () => {
    const state = stateWith(NOV, [expense("a", "nov")]);
    const next = reducer(state, addExpense(expense("a", "nov")));
    expect(ids(next)).toEqual(["a"]);
  });

  it("keeps the paging state", () => {
    const state = stateWith(NOV, [expense("a", "nov")]);
    for (const row of [expense("b", "nov"), expense("c", "oct")]) {
      const next = reducer(state, addExpense(row));
      expect(next.nextCursor).toBe("cursor-1");
      expect(next.hasMore).toBe(true);
      expect(next.activeLedger).toEqual(NOV);
    }
  });

  it("puts a back-dated row in its date's place, not at the top", () => {
    const state = stateWith(OCT, octoberRows());
    const next = reducer(state, addExpense(expense("b15", "oct", on("2026-10-15"))));
    expect(ids(next)).toEqual(["a31", "a20", "b15", "a12"]);
  });

  it("puts a row next to the others of its day, so the day keeps one header", () => {
    const state = stateWith(OCT, octoberRows());
    const next = reducer(state, addExpense(expense("b12", "oct", on("2026-10-12"))));
    expect(ids(next)).toEqual(["a31", "a20", "b12", "a12"]);
  });

  it("does not list a row older than every loaded one while more pages are to come", () => {
    const state = stateWith(OCT, octoberRows());
    const next = reducer(state, addExpense(expense("b01", "oct", on("2026-10-01"))));
    expect(ids(next)).toEqual(["a31", "a20", "a12"]);
  });

  it("lists a row older than every other one at the end once all pages are loaded", () => {
    const state = stateWith(OCT, octoberRows(), false);
    const next = reducer(state, addExpense(expense("b01", "oct", on("2026-10-01"))));
    expect(ids(next)).toEqual(["a31", "a20", "a12", "b01"]);
  });
});

describe("updateExpense", () => {
  it("swaps the row in place when it stays in the month on screen", () => {
    const state = stateWith(NOV, [
      expense("a", "nov", on("2026-11-03")),
      expense("b", "nov", on("2026-11-02")),
      expense("c", "nov", on("2026-11-01")),
    ]);
    const edited = expense("b", "nov", { ...on("2026-11-02"), amount: 250 });
    const next = reducer(state, updateExpense({ expense: edited }));
    expect(ids(next)).toEqual(["a", "b", "c"]);
    expect(next.expenses[1].amount).toBe(250);
  });

  it("swaps the row found by oldId (a temp row replaced by the saved one)", () => {
    const state = stateWith(NOV, [expense("temp-1", "nov"), expense("a", "nov")]);
    const saved = expense("real-1", "nov");
    const next = reducer(
      state,
      updateExpense({ oldId: "temp-1", expense: saved }),
    );
    expect(ids(next)).toEqual(["real-1", "a"]);
  });

  it("removes the row when the edit moved it to another month", () => {
    const state = stateWith(NOV, [
      expense("a", "nov", on("2026-11-03")),
      expense("b", "nov", on("2026-11-02")),
      expense("c", "nov", on("2026-11-01")),
    ]);
    const moved = expense("b", "oct", { date: "2026-10-31T00:00:00.000Z" });
    const next = reducer(state, updateExpense({ expense: moved }));
    expect(ids(next)).toEqual(["a", "c"]);
  });

  it("removes the row found by oldId when the edit moved it", () => {
    const state = stateWith(NOV, [expense("temp-1", "nov"), expense("a", "nov")]);
    const next = reducer(
      state,
      updateExpense({ oldId: "temp-1", expense: expense("real-1", "oct") }),
    );
    expect(ids(next)).toEqual(["a"]);
  });

  it("does nothing for a row that is not in the list", () => {
    const state = stateWith(NOV, [expense("a", "nov")]);
    const sameMonth = reducer(
      state,
      updateExpense({ expense: expense("zzz", "nov") }),
    );
    const otherMonth = reducer(
      state,
      updateExpense({ expense: expense("zzz", "oct") }),
    );
    expect(sameMonth.expenses).toEqual(state.expenses);
    expect(otherMonth.expenses).toEqual(state.expenses);
  });

  it("swaps in place when no month is on screen", () => {
    const state = stateWith(null, [expense("a", "nov")]);
    const next = reducer(
      state,
      updateExpense({ expense: expense("a", "oct", { amount: 7 }) }),
    );
    expect(ids(next)).toEqual(["a"]);
    expect(next.expenses[0].amount).toBe(7);
  });

  it("keeps the paging state", () => {
    const state = stateWith(NOV, [expense("b", "nov"), expense("a", "nov")]);
    for (const row of [expense("a", "nov", { amount: 9 }), expense("b", "oct")]) {
      const next = reducer(state, updateExpense({ expense: row }));
      expect(next.nextCursor).toBe("cursor-1");
      expect(next.hasMore).toBe(true);
      expect(next.activeLedger).toEqual(NOV);
    }
  });
});

describe("updateExpense: a new date in the same month", () => {
  it("moves the row to its new date's place", () => {
    const state = stateWith(OCT, octoberRows());
    const older = reducer(
      state,
      updateExpense({ expense: expense("a31", "oct", on("2026-10-15")) }),
    );
    expect(ids(older)).toEqual(["a20", "a31", "a12"]);
    const newer = reducer(
      state,
      updateExpense({ expense: expense("a12", "oct", on("2026-10-25")) }),
    );
    expect(ids(newer)).toEqual(["a31", "a12", "a20"]);
  });

  it("moves the row found by oldId to the saved row's date", () => {
    const state = stateWith(OCT, [
      expense("temp-1", "oct", on("2026-10-31")),
      ...octoberRows(),
    ]);
    const saved = expense("real-1", "oct", on("2026-10-15"));
    const next = reducer(state, updateExpense({ oldId: "temp-1", expense: saved }));
    expect(ids(next)).toEqual(["a31", "a20", "real-1", "a12"]);
  });

  it("keeps the last loaded row when an edit leaves its date alone", () => {
    const state = stateWith(OCT, octoberRows());
    const edited = expense("a12", "oct", { ...on("2026-10-12"), amount: 7 });
    const next = reducer(state, updateExpense({ expense: edited }));
    expect(ids(next)).toEqual(["a31", "a20", "a12"]);
    expect(next.expenses[2].amount).toBe(7);
  });
});
