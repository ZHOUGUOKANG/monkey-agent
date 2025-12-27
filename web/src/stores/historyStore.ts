import { create } from 'zustand';
import { storage } from '../services/storage';
import type { Conversation } from '../types';

interface HistoryStore {
  conversations: Conversation[];
  loadHistory: () => void;
  saveConversation: (conversation: Conversation) => void;
  deleteConversation: (id: string) => void;
  clearAll: () => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  conversations: [],
  
  loadHistory: () => {
    const conversations = storage.getHistory();
    set({ conversations });
  },
  
  saveConversation: (conversation) => {
    storage.saveConversation(conversation);
    set((state) => ({
      conversations: [...state.conversations, conversation],
    }));
  },
  
  deleteConversation: (id) => {
    storage.deleteConversation(id);
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    }));
  },
  
  clearAll: () => {
    storage.clearHistory();
    set({ conversations: [] });
  },
}));

