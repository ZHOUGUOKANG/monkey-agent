import type { Conversation } from '../types';

class StorageService {
  private readonly HISTORY_KEY = 'chat-history';
  private readonly THEME_KEY = 'theme';

  saveConversation(conversation: Conversation) {
    const history = this.getHistory();
    history.push(conversation);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
  }

  getHistory(): Conversation[] {
    try {
      const data = localStorage.getItem(this.HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  }

  deleteConversation(id: string) {
    const history = this.getHistory().filter((c) => c.id !== id);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
  }

  clearHistory() {
    localStorage.removeItem(this.HISTORY_KEY);
  }

  saveTheme(isDark: boolean) {
    localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
  }

  getTheme(): boolean {
    const theme = localStorage.getItem(this.THEME_KEY);
    // 默认使用系统偏好
    if (!theme) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  }
}

export const storage = new StorageService();

