import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IFriend, IFriendRequest, IContactSyncResult } from "../../types";

interface FriendState {
  friends: IFriend[];
  incomingRequests: IFriendRequest[];
  sentRequests: IFriendRequest[];
  searchResult: {
    exists: boolean;
    user?: IFriend;
  } | null;
  contactSyncResult: IContactSyncResult | null;
  loading: boolean;
}

const initialState: FriendState = {
  friends: [],
  incomingRequests: [],
  sentRequests: [],
  searchResult: null,
  contactSyncResult: null,
  loading: false,
};

const friendSlice = createSlice({
  name: "friend",
  initialState,
  reducers: {
    setFriends: (state, action: PayloadAction<IFriend[]>) => {
      state.friends = action.payload;
      state.loading = false;
    },
    setIncomingRequests: (state, action: PayloadAction<IFriendRequest[]>) => {
      state.incomingRequests = action.payload;
    },
    setSentRequests: (state, action: PayloadAction<IFriendRequest[]>) => {
      state.sentRequests = action.payload;
    },
    setSearchResult: (
      state,
      action: PayloadAction<FriendState["searchResult"]>,
    ) => {
      state.searchResult = action.payload;
    },
    setContactSyncResult: (
      state,
      action: PayloadAction<IContactSyncResult | null>,
    ) => {
      state.contactSyncResult = action.payload;
    },
    removeIncomingRequest: (state, action: PayloadAction<string>) => {
      state.incomingRequests = state.incomingRequests.filter(
        (req) => req._id !== action.payload,
      );
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    resetFriendState: () => initialState,
  },
});

export const {
  setFriends,
  setIncomingRequests,
  setSentRequests,
  setSearchResult,
  setContactSyncResult,
  removeIncomingRequest,
  setLoading,
  resetFriendState,
} = friendSlice.actions;

export default friendSlice.reducer;
