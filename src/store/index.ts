import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import authReducer from "./slices/authSlice";
import chatReducer from "./slices/chatSlice";
import friendReducer from "./slices/friendSlice";
import poolReducer from "./slices/poolSlice";
import expenseReducer from "./slices/expenseSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    friend: friendReducer,
    pool: poolReducer,
    expense: expenseReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
