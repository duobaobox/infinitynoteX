import { createContext } from 'react';

// ============================================================
// Context（列表场景批量传递 selectedId）
// ============================================================

export interface CardListContextValue {
  selectedId?: string;
}

export const CardListContext = createContext<CardListContextValue | undefined>(undefined);
