import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IUser } from "../../types";

interface AuthState {
  user: IUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  initializing: boolean; // True while checking stored tokens on app start
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  initializing: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<IUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
      state.initializing = false;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.initializing = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setInitializing: (state, action: PayloadAction<boolean>) => {
      state.initializing = action.payload;
    },
    updateAvatar: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.avatar = action.payload;
      }
    },
    updateUser: (state, action: PayloadAction<Partial<IUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const {
  setCredentials,
  logout,
  setLoading,
  setInitializing,
  updateAvatar,
  updateUser,
} = authSlice.actions;

export default authSlice.reducer;
