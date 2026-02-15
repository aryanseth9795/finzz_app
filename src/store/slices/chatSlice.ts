import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IChat, ITx, IChatStats } from "../../types";

interface ChatState {
  chats: IChat[];
  activeChat: IChat | null;
  transactions: ITx[];
  stats: IChatStats | null;
  loading: boolean;
  txLoading: boolean;
  nextCursor: string | null;
  hasMore: boolean;
}

const initialState: ChatState = {
  chats: [],
  activeChat: null,
  transactions: [],
  stats: null,
  loading: false,
  txLoading: false,
  nextCursor: null,
  hasMore: true,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setChats: (state, action: PayloadAction<IChat[]>) => {
      state.chats = action.payload;
      state.loading = false;
    },
    setActiveChat: (state, action: PayloadAction<IChat | null>) => {
      state.activeChat = action.payload;
    },
    setTransactions: (
      state,
      action: PayloadAction<{
        txns: ITx[];
        nextCursor: string | null;
        hasMore: boolean;
      }>,
    ) => {
      state.transactions = action.payload.txns;
      state.nextCursor = action.payload.nextCursor;
      state.hasMore = action.payload.hasMore;
      state.txLoading = false;
    },
    appendTransactions: (
      state,
      action: PayloadAction<{
        txns: ITx[];
        nextCursor: string | null;
        hasMore: boolean;
      }>,
    ) => {
      state.transactions = [...state.transactions, ...action.payload.txns];
      state.nextCursor = action.payload.nextCursor;
      state.hasMore = action.payload.hasMore;
      state.txLoading = false;
    },
    addTx: (state, action: PayloadAction<ITx>) => {
      state.transactions = [action.payload, ...state.transactions];
    },
    updateTx: (state, action: PayloadAction<ITx>) => {
      const index = state.transactions.findIndex(
        (tx) => tx._id === action.payload._id,
      );
      if (index !== -1) {
        state.transactions[index] = action.payload;
      }
    },
    removeTx: (state, action: PayloadAction<string>) => {
      state.transactions = state.transactions.filter(
        (tx) => tx._id !== action.payload,
      );
    },
    setStats: (state, action: PayloadAction<IChatStats | null>) => {
      state.stats = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setTxLoading: (state, action: PayloadAction<boolean>) => {
      state.txLoading = action.payload;
    },
    resetChat: (state) => {
      state.activeChat = null;
      state.transactions = [];
      state.stats = null;
      state.nextCursor = null;
      state.hasMore = true;
    },
  },
});

export const {
  setChats,
  setActiveChat,
  setTransactions,
  appendTransactions,
  addTx,
  updateTx,
  removeTx,
  setStats,
  setLoading,
  setTxLoading,
  resetChat,
} = chatSlice.actions;

export default chatSlice.reducer;
