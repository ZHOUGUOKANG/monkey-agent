import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontSize: 14,
    colorBgContainer: '#ffffff',
  },
};

export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontSize: 14,
  },
  algorithm: theme.darkAlgorithm,
};

