import { configureStore, combineReducers, Action } from "@reduxjs/toolkit";
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import authReducer, { logout } from "./slices/authSlice";
import chatReducer from "./slices/chatSlice";
import friendReducer from "./slices/friendSlice";
import poolReducer from "./slices/poolSlice";
import expenseReducer from "./slices/expenseSlice";

const appReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
  friend: friendReducer,
  pool: poolReducer,
  expense: expenseReducer,
});

export type RootState = ReturnType<typeof appReducer>;

/**
 * Root reducer with a global reset on logout.
 *
 * Previously `authSlice.logout` cleared only the `auth` slice. The `chat`,
 * `friend`, `pool` and `expense` slices kept everything — so after signing out
 * and signing in as somebody else, the new user saw the previous user's chat
 * list, transaction rows, balances, friend requests and expense ledger until
 * each screen's first successful refetch. On a slow or failed network that
 * state persisted indefinitely, because every fetch handler in the app
 * swallowed errors and left the previous data on screen.
 *
 * Each slice already exported a reset action (`resetChat`, `resetExpense`,
 * `resetFriendState`) and none of them were ever dispatched — the need was
 * anticipated and the wiring forgotten.
 *
 * Handling it here rather than dispatching four actions means the guarantee
 * holds for every slice that exists today and every slice added tomorrow:
 * passing `undefined` makes each reducer return its own initial state.
 */
const rootReducer = (
  state: RootState | undefined,
  action: Action,
): RootState => {
  if (action.type === logout.type) {
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Dates and other non-plain values flow through some payloads; the check
      // is a development-only warning and costs a deep scan of every action.
      serializableCheck: false,
    }),
});

export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
