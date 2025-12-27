import React from 'react';
import { Badge } from 'antd';
import { useConnectionStore } from '../../stores/connectionStore';

export const ConnectionStatus: React.FC = () => {
  const status = useConnectionStore((state) => state.status);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return { status: 'success' as const, text: '已连接' };
      case 'connecting':
        return { status: 'processing' as const, text: '连接中' };
      case 'disconnected':
        return { status: 'default' as const, text: '未连接' };
      case 'error':
        return { status: 'error' as const, text: '连接失败' };
      default:
        return { status: 'default' as const, text: '未知' };
    }
  };

  const config = getStatusConfig();

  return <Badge status={config.status} text={config.text} />;
};

