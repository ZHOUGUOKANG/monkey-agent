import React, { useState, useEffect } from 'react';
import { Card, Steps, Typography, Collapse, Space } from 'antd';
import { 
  LoadingOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  BulbOutlined,
  ToolOutlined
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface AgentStatus {
  phase: 'thinking' | 'recognizing' | 'tool-call' | 'tool-result' | 'complete' | 'error';
  message: string;
  details?: any;
  timestamp: number;
}

interface AgentStatusIndicatorProps {
  isProcessing: boolean;
}

export const AgentStatusIndicator: React.FC<AgentStatusIndicatorProps> = () => {
  const [statusHistory, setStatusHistory] = useState<AgentStatus[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AgentStatus | null>(null);

  // 不再在完成后清空状态，保留历史记录
  // useEffect(() => {
  //   if (!isProcessing) {
  //     // 清空状态（延迟一点，让用户看到完成状态）
  //     const timer = setTimeout(() => {
  //       setCurrentStatus(null);
  //       setStatusHistory([]);
  //     }, 3000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [isProcessing]);

  // 从父组件接收状态更新
  useEffect(() => {
    const handleStatusUpdate = (event: CustomEvent<AgentStatus>) => {
      const status = event.detail;
      setCurrentStatus(status);
      setStatusHistory(prev => [...prev, status]);
    };

    window.addEventListener('agent-status-update' as any, handleStatusUpdate);
    return () => {
      window.removeEventListener('agent-status-update' as any, handleStatusUpdate);
    };
  }, []);

  // 只要有状态历史就显示，不再在完成后隐藏
  if (!currentStatus && statusHistory.length === 0) {
    return null;
  }

  const getStatusIcon = (phase: AgentStatus['phase']) => {
    switch (phase) {
      case 'thinking':
        return <LoadingOutlined style={{ color: '#1890ff' }} spin />;
      case 'recognizing':
        return <BulbOutlined style={{ color: '#faad14' }} />;
      case 'tool-call':
        return <ToolOutlined style={{ color: '#13c2c2' }} />;
      case 'tool-result':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'complete':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <LoadingOutlined spin />;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
  };

  return (
    <Card
      size="small"
      style={{
        marginTop: 16,
        marginBottom: 16,
        background: 'var(--ant-color-bg-container)',
        borderLeft: '3px solid #1890ff'
      }}
    >
      {/* 当前状态 */}
      {currentStatus && (
        <Space style={{ width: '100%', marginBottom: statusHistory.length > 1 ? 12 : 0 }}>
          {getStatusIcon(currentStatus.phase)}
          <Text strong>{currentStatus.message}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatTime(currentStatus.timestamp)}
          </Text>
        </Space>
      )}

      {/* 历史记录 */}
      {statusHistory.length > 1 && (
        <Collapse 
          ghost 
          size="small"
          items={[{
            key: 'history',
            label: `执行历史 (${statusHistory.length} 步)`,
            children: (
              <Steps
                orientation="vertical"
                size="small"
                current={statusHistory.length}
                items={statusHistory.map((status, index) => ({
                  title: (
                    <Space>
                      <Text>{status.message}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {formatTime(status.timestamp)}
                      </Text>
                    </Space>
                  ),
                  status: status.phase === 'error' ? 'error' : 
                          index === statusHistory.length - 1 ? 'process' : 'finish',
                  icon: getStatusIcon(status.phase),
                  ...(status.details && {
                    description: (
                      <Paragraph
                        style={{ 
                          fontSize: 12, 
                          marginTop: 4,
                          padding: 8,
                          background: 'var(--ant-color-bg-layout)',
                          borderRadius: 4,
                          fontFamily: 'monospace'
                        }}
                        ellipsis={{ rows: 3, expandable: true }}
                      >
                        {typeof status.details === 'string' 
                          ? status.details 
                          : JSON.stringify(status.details, null, 2)}
                      </Paragraph>
                    )
                  })
                }))}
              />
            )
          }]}
        />
      )}
    </Card>
  );
};

// 辅助函数：从外部触发状态更新
export const updateAgentStatus = (status: AgentStatus) => {
  const event = new CustomEvent('agent-status-update', { detail: status });
  window.dispatchEvent(event);
};

