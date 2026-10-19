import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { INote, NoteScope } from "../../types";
import { mergeNotes } from "../../utils/notes";

interface NotesState {
  items: INote[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  scope: NoteScope;
  label: string | null;
  q: string;
}

interface NotesPagePayload {
  notes: INote[];
  nextCursor: string | null;
  hasMore: boolean;
}

const initialState: NotesState = {
  items: [],
  nextCursor: null,
  hasMore: true,
  loading: false,
  scope: "all",
  label: null,
  q: "",
};

const notesSlice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    setNotes: (state, action: PayloadAction<NotesPagePayload>) => {
      state.items = action.payload.notes;
      state.nextCursor = action.payload.nextCursor;
      state.hasMore = action.payload.hasMore;
      state.loading = false;
    },
    appendNotes: (state, action: PayloadAction<NotesPagePayload>) => {
      state.items = mergeNotes(state.items, action.payload.notes);
      state.nextCursor = action.payload.nextCursor;
      state.hasMore = action.payload.hasMore;
      state.loading = false;
    },
    upsertNote: (state, action: PayloadAction<INote>) => {
      const i = state.items.findIndex((n) => n._id === action.payload._id);
      if (i >= 0) state.items[i] = action.payload;
      else state.items.unshift(action.payload);
    },
    removeNote: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((n) => n._id !== action.payload);
    },
    setNotesFilter: (
      state,
      action: PayloadAction<
        Partial<{ scope: NoteScope; label: string | null; q: string }>
      >,
    ) => {
      if (action.payload.scope !== undefined) state.scope = action.payload.scope;
      if (action.payload.label !== undefined) state.label = action.payload.label;
      if (action.payload.q !== undefined) state.q = action.payload.q;
    },
    setNotesLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const {
  setNotes,
  appendNotes,
  upsertNote,
  removeNote,
  setNotesFilter,
  setNotesLoading,
} = notesSlice.actions;

export default notesSlice.reducer;
