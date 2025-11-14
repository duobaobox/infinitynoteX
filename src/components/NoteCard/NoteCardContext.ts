import React from 'react';

export interface NoteCardListContextValue {
  selectedId?: string;
}

export const NoteCardListContext = React.createContext<NoteCardListContextValue | undefined>(
  undefined,
);
