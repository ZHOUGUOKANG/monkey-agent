import { useState, useEffect } from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { MainLayout } from './layouts/MainLayout';
import { ChatPage } from './pages/ChatPage';
import { HistoryPage } from './pages/HistoryPage';
import { LogsPage } from './pages/LogsPage';
import { useThemeStore } from './stores/themeStore';
import { useConnectionStore } from './stores/connectionStore';
import { wsClient } from './services/websocket';
import { lightTheme, darkTheme } from './styles/theme';
import './styles/global.css';

dayjs.locale('zh-cn');

type PageType = 'chat' | 'history' | 'logs';

function App() {
  const isDark = useThemeStore((state) => state.isDark);
  const setConnectionStatus = useConnectionStore((state) => state.setStatus);
  const [currentPage, setCurrentPage] = useState<PageType>('chat');

  useEffect(() => {
    // 连接 WebSocket
    setConnectionStatus('connecting');
    wsClient.connect();

    wsClient.on('connect', () => {
      setConnectionStatus('connected');
    });

    wsClient.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    wsClient.on('error', () => {
      setConnectionStatus('error');
    });

    return () => {
      wsClient.disconnect();
    };
  }, [setConnectionStatus]);

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatPage />;
      case 'history':
        return <HistoryPage />;
      case 'logs':
        return <LogsPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <ConfigProvider
      theme={isDark ? darkTheme : lightTheme}
      locale={zhCN}
    >
      <AntdApp>
        <MainLayout currentPage={currentPage} onPageChange={setCurrentPage}>
          {renderPage()}
        </MainLayout>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;

