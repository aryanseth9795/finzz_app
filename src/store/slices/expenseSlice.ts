import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IExpense, IExpenseLedger, IExpenseStats } from "../../types";

interface ExpenseState {
  expenses: IExpense[];
  ledgers: IExpenseLedger[];
  activeLedger: IExpenseLedger | null;
  stats: IExpenseStats | null;
  loading: boolean;
  txLoading: boolean;
  nextCursor: string | null;
  hasMore: boolean;
}

const initialState: ExpenseState = {
  expenses: [],
  ledgers: [],
  activeLedger: null,
  stats: null,
  loading: false,
  txLoading: false,
  nextCursor: null,
  hasMore: true,
};

const expenseSlice = createSlice({
  name: "expense",
  initialState,
  reducers: {
    setExpenses: (
      state,
      action: PayloadAction<{
        expenses: IExpense[];
        nextCursor: string | null;
        hasMore: boolean;
      }>,
    ) => {
      state.expenses = action.payload.expenses;
      state.nextCursor = action.payload.nextCursor;
      state.hasMore = action.payload.hasMore;
      state.txLoading = false;
    },
    appendExpenses: (
      state,
      action: PayloadAction<{
        expenses: IExpense[];
        nextCursor: string | null;
        hasMore: boolean;
      }>,
    ) => {
      const existingIds = new Set(state.expenses.map((e) => e._id));
      const newUnique = action.payload.expenses.filter(
        (e) => !existingIds.has(e._id),
      );
      state.expenses = [...state.expenses, ...newUnique];
      state.nextCursor = action.payload.nextCursor;
      state.hasMore = action.payload.hasMore;
      state.txLoading = false;
    },
    addExpense: (state, action: PayloadAction<IExpense>) => {
      state.expenses = [action.payload, ...state.expenses];
    },
    updateExpense: (
      state,
      action: PayloadAction<{ oldId?: string; expense: IExpense }>,
    ) => {
      const { oldId, expense } = action.payload;
      const searchId = oldId || expense._id;
      const index = state.expenses.findIndex((e) => e._id === searchId);
      if (index !== -1) {
        state.expenses[index] = expense;
      }
    },
    removeExpense: (state, action: PayloadAction<string>) => {
      state.expenses = state.expenses.filter((e) => e._id !== action.payload);
    },
    setLedgers: (state, action: PayloadAction<IExpenseLedger[]>) => {
      state.ledgers = action.payload;
      state.loading = false;
    },
    setActiveLedger: (state, action: PayloadAction<IExpenseLedger | null>) => {
      state.activeLedger = action.payload;
    },
    updateLedger: (state, action: PayloadAction<IExpenseLedger>) => {
      const index = state.ledgers.findIndex(
        (l) => l._id === action.payload._id,
      );
      if (index !== -1) {
        state.ledgers[index] = action.payload;
      }
      if (state.activeLedger?._id === action.payload._id) {
        state.activeLedger = action.payload;
      }
    },
    setStats: (state, action: PayloadAction<IExpenseStats | null>) => {
      state.stats = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setTxLoading: (state, action: PayloadAction<boolean>) => {
      state.txLoading = action.payload;
    },
    resetExpense: (state) => {
      state.expenses = [];
      state.nextCursor = null;
      state.hasMore = true;
      state.stats = null;
    },
  },
});

export const {
  setExpenses,
  appendExpenses,
  addExpense,
  updateExpense,
  removeExpense,
  setLedgers,
  setActiveLedger,
  updateLedger,
  setStats,
  setLoading,
  setTxLoading,
  resetExpense,
} = expenseSlice.actions;

export default expenseSlice.reducer;
