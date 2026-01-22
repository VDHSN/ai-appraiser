import { create } from "zustand";
import type { SearchResult, UnifiedItem } from "@/lib/adapters/types";

export type CompareItem = SearchResult | UnifiedItem;

interface CompareState {
  items: CompareItem[];
  isOpen: boolean;
  addItem: (item: CompareItem) => void;
  removeItem: (itemId: string) => void;
  clearItems: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  hasItem: (itemId: string) => boolean;
}

const MAX_ITEMS = 4;

function getItemId(item: CompareItem): string {
  return "id" in item ? item.id : item.itemId;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  items: [],
  isOpen: false,

  addItem: (item) => {
    const { items } = get();
    const itemId = getItemId(item);
    if (items.length >= MAX_ITEMS) return;
    if (items.some((i) => getItemId(i) === itemId)) return;
    set({ items: [...items, item] });
  },

  removeItem: (itemId) => {
    set((state) => ({
      items: state.items.filter((i) => getItemId(i) !== itemId),
    }));
  },

  clearItems: () => set({ items: [], isOpen: false }),

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  setOpen: (open) => set({ isOpen: open }),

  hasItem: (itemId) => {
    return get().items.some((i) => getItemId(i) === itemId);
  },
}));
