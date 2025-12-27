import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Card, List, Tag, Space, Typography, Button, Switch } from 'antd';
import { useChatStore } from '../../stores/chatStore';

const { Text } = Typography;

export const EventLogPanel: React.FC = () => {
  const chatEvents = useChatStore((state) => state.chatEvents);
  const workflowExecution = useChatStore((state) => state.workflowExecution);
  const listEndRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('all'); // all, important, errors

  // 自动滚动到底部（仅当启用时）
  useEffect(() => {
    if (autoScroll) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatEvents.length, autoScroll]); // 只依赖事件数量，不是整个数组

  // 检测用户是否手动滚动
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 过滤和优化事件
  const filteredEvents = useMemo(() => {
    let events = chatEvents;

    // 根据过滤器过滤
    if (filter === 'important') {
      events = events.filter(e => 
        e.type.includes('error') || 
        e.type.includes('complete') ||
        e.type.includes('tool-call') ||
        e.type.includes('workflow') ||
        e.source === 'user'
      );
    } else if (filter === 'errors') {
      events = events.filter(e => e.type.includes('error'));
    }

    return events;
  }, [chatEvents, filter]);

  const getEventColor = (source: string, type: string) => {
    if (source === 'user') return 'blue';
    if (source === 'system') return 'default';
    if (type.includes('error')) return 'error';
    if (type.includes('complete')) return 'success';
    if (type.includes('thinking') || type.includes('stream')) return 'processing';
    if (type.includes('tool')) return 'orange';
    if (type.includes('workflow')) return 'purple';
    return 'cyan';
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'user': return '👤';
      case 'ai': return '🤖';
      case 'workflow': return '⚙️';
      case 'agent': return '🔧';
      case 'system': return '💻';
      default: return '📝';
    }
  };

  const formatEventMessage = (event: any) => {
    if (event.message) {
      // 如果有 count，显示合并的事件数
      if (event.count && event.count > 1) {
        return `${event.message} (×${event.count})`;
      }
      return event.message;
    }
    
    const { type, data } = event;
    
    // 根据事件类型格式化消息
    if (type === 'stream') {
      const countStr = event.count > 1 ? ` (×${event.count})` : '';
      return `流式响应: ${data?.type || 'text'}${countStr}`;
    }
    if (type === 'agent:thinking') {
      const countStr = event.count > 1 ? ` (×${event.count})` : '';
      return `思考中...${countStr}`;
    }
    if (type === 'agent:stream-text') {
      const countStr = event.count > 1 ? ` (×${event.count} chunks)` : '';
      return `生成文本${countStr}`;
    }
    if (type === 'agent:tool-call') return `🔧 调用工具: ${data?.toolName}`;
    if (type === 'agent:tool-result') return `✅ 工具结果: ${data?.toolName || '完成'}`;
    if (type === 'agent:tool-error') return `❌ 工具错误: ${data?.error}`;
    if (type === 'agent:start') return `开始执行: ${data?.agentId}`;
    if (type === 'agent:complete') return `完成: ${data?.agentId}`;
    if (type === 'agent:error') return `错误: ${data?.error}`;
    if (type === 'workflow:event') return `Workflow 事件`;
    
    return type;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
  };

  if (chatEvents.length === 0) {
    return (
      <Card 
        title="事件日志" 
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, overflow: 'auto', padding: 12 }}
      >
        <Text type="secondary">等待事件...</Text>
      </Card>
    );
  }

  return (
    <Card 
      title={
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Text>事件日志</Text>
              <Tag color="blue">{filteredEvents.length}</Tag>
            </Space>
            {workflowExecution && (
              <Tag color={workflowExecution.status === 'running' ? 'processing' : workflowExecution.status === 'completed' ? 'success' : 'error'}>
                {workflowExecution.status === 'running' ? '运行中' : workflowExecution.status === 'completed' ? '已完成' : '失败'}
              </Tag>
            )}
          </Space>
          
          {/* 控制栏 */}
          <Space size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space size={4}>
              <Button 
                size="small" 
                type={filter === 'all' ? 'primary' : 'default'}
                onClick={() => setFilter('all')}
              >
                全部
              </Button>
              <Button 
                size="small" 
                type={filter === 'important' ? 'primary' : 'default'}
                onClick={() => setFilter('important')}
              >
                重要
              </Button>
              <Button 
                size="small" 
                type={filter === 'errors' ? 'primary' : 'default'}
                danger={filter === 'errors'}
                onClick={() => setFilter('errors')}
              >
                错误
              </Button>
            </Space>
            
            <Space size={4}>
              <Text style={{ fontSize: 11 }}>自动滚动</Text>
              <Switch 
                size="small" 
                checked={autoScroll} 
                onChange={setAutoScroll}
              />
            </Space>
          </Space>
        </Space>
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, overflow: 'auto', padding: 0 }}
    >
      <div ref={listContainerRef} style={{ height: '100%', overflow: 'auto' }}>
        <List
          size="small"
          dataSource={filteredEvents}
          renderItem={(event, index) => (
            <List.Item 
              key={event.id}
              style={{ 
                padding: '8px 12px', 
                borderBottom: '1px solid var(--ant-color-border)',
                background: index % 2 === 0 ? 'transparent' : 'var(--ant-color-fill-quaternary)'
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={2}>
                {/* 事件头部 */}
                <Space size={6} style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space size={4}>
                    <span style={{ fontSize: 12 }}>{getSourceIcon(event.source)}</span>
                    <Tag 
                      color={getEventColor(event.source, event.type)} 
                      style={{ margin: 0, fontSize: 9, padding: '0 4px' }}
                    >
                      {event.source}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 9 }}>
                    {formatTimestamp(event.timestamp)}
                  </Text>
                </Space>
                
                {/* 事件消息 */}
                <Text style={{ fontSize: 11, wordBreak: 'break-word' }}>
                  {formatEventMessage(event)}
                </Text>
                
                {/* 节点信息（只在重要事件显示） */}
                {event.data?.nodeId && (filter === 'all' || filter === 'important') && (
                  <Text type="secondary" style={{ fontSize: 9 }}>
                    节点: {event.data.nodeId}
                  </Text>
                )}
              </Space>
            </List.Item>
          )}
        />
        <div ref={listEndRef} />
      </div>
    </Card>
  );
};

