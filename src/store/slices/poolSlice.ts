import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IPool, IPoolTx, IPoolStats } from "../../types";

interface PoolState {
  pools: IPool[];
  activePool: IPool | null;
  transactions: IPoolTx[];
  stats: IPoolStats | null;
  loading: boolean;
  txLoading: boolean;
  nextCursor: string | null;
  hasMore: boolean;
}

const initialState: PoolState = {
  pools: [],
  activePool: null,
  transactions: [],
  stats: null,
  loading: false,
  txLoading: false,
  nextCursor: null,
  hasMore: true,
};

const poolSlice = createSlice({
  name: "pool",
  initialState,
  reducers: {
    setPools: (state, action: PayloadAction<IPool[]>) => {
      state.pools = action.payload;
      state.loading = false;
    },
    setActivePool: (state, action: PayloadAction<IPool | null>) => {
      state.activePool = action.payload;
    },
    setPoolTransactions: (
      state,
      action: PayloadAction<{
        poolTxns: IPoolTx[];
        nextCursor: string | null;
        hasMore: boolean;
      }>,
    ) => {
      state.transactions = action.payload.poolTxns;
      state.nextCursor = action.payload.nextCursor;
      state.hasMore = action.payload.hasMore;
      state.txLoading = false;
    },
    appendPoolTransactions: (
      state,
      action: PayloadAction<{
        poolTxns: IPoolTx[];
        nextCursor: string | null;
        hasMore: boolean;
      }>,
    ) => {
      state.transactions = [...state.transactions, ...action.payload.poolTxns];
      state.nextCursor = action.payload.nextCursor;
      state.hasMore = action.payload.hasMore;
      state.txLoading = false;
    },
    addPoolTx: (state, action: PayloadAction<IPoolTx>) => {
      state.transactions = [action.payload, ...state.transactions];
    },
    updatePoolTx: (state, action: PayloadAction<IPoolTx>) => {
      const index = state.transactions.findIndex(
        (tx) => tx._id === action.payload._id,
      );
      if (index !== -1) {
        state.transactions[index] = action.payload;
      }
    },
    removePoolTx: (state, action: PayloadAction<string>) => {
      state.transactions = state.transactions.filter(
        (tx) => tx._id !== action.payload,
      );
    },
    setPoolStats: (state, action: PayloadAction<IPoolStats | null>) => {
      state.stats = action.payload;
    },
    setPoolLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setPoolTxLoading: (state, action: PayloadAction<boolean>) => {
      state.txLoading = action.payload;
    },
    resetPool: (state) => {
      state.activePool = null;
      state.transactions = [];
      state.stats = null;
      state.nextCursor = null;
      state.hasMore = true;
    },
  },
});

export const {
  setPools,
  setActivePool,
  setPoolTransactions,
  appendPoolTransactions,
  addPoolTx,
  updatePoolTx,
  removePoolTx,
  setPoolStats,
  setPoolLoading,
  setPoolTxLoading,
  resetPool,
} = poolSlice.actions;

export default poolSlice.reducer;
