import { create } from 'zustand';
import type { LogEntry } from '../types';

interface LogStore {
  logs: LogEntry[];
  isPaused: boolean;
  addLog: (log: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
  clearLogs: () => void;
  setPaused: (isPaused: boolean) => void;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  isPaused: false,
  
  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs, log],
    })),
  
  setLogs: (logs) => set({ logs }),
  
  clearLogs: () => set({ logs: [] }),
  
  setPaused: (isPaused) => set({ isPaused }),
}));

