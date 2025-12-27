import { create } from 'zustand';
import { storage } from '../services/storage';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  isDark: storage.getTheme(),
  
  toggleTheme: () =>
    set((state) => {
      const newTheme = !state.isDark;
      storage.saveTheme(newTheme);
      return { isDark: newTheme };
    }),
  
  setTheme: (isDark) => {
    storage.saveTheme(isDark);
    set({ isDark });
  },
}));

