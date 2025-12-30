import React, { useEffect, useRef, useMemo, useState, memo } from 'react';
import { Card, List, Tag, Space, Typography, Button, Switch, Collapse } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/chatStore';

const { Text } = Typography;
const { Panel } = Collapse;

// 事件组接口
interface EventGroup {
  id: string;
  type: string;
  source: string;
  count: number;
  events: any[];
  firstTimestamp: number;
  lastTimestamp: number;
}

// 优化：将事件组渲染提取为独立组件并使用memo
const EventGroupItem = memo<{
  group: EventGroup;
  isExpanded: boolean;
  expandedEvents: Set<string>;
  onToggleGroup: (groupId: string) => void;
  onToggleEvent: (eventId: string) => void;
  getSourceIcon: (source: string) => string;
  getEventColor: (source: string, type: string) => string;
  formatEventType: (type: string) => string;
  formatTimestamp: (timestamp: number) => string;
}>(({
  group,
  isExpanded,
  expandedEvents,
  onToggleGroup,
  onToggleEvent,
  getSourceIcon,
  getEventColor,
  formatEventType,
  formatTimestamp
}) => {
  const isMerged = group.count > 1;

  const renderEventDetail = (event: any) => {
    const isEventExpanded = expandedEvents.has(event.id);
    
    const detailContent = useMemo(() => {
      if (!isEventExpanded) return null;
      return JSON.stringify(event.data || event, null, 2);
    }, [isEventExpanded, event]);
    
    return (
      <div style={{ marginTop: 8 }}>
        <Button
          type="link"
          size="small"
          icon={isEventExpanded ? <DownOutlined /> : <RightOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onToggleEvent(event.id);
          }}
          style={{ padding: 0, height: 'auto', fontSize: 10 }}
        >
          {isEventExpanded ? '收起详情' : '查看详情'}
        </Button>
        
        {isEventExpanded && (
          <div style={{
            marginTop: 8,
            padding: 8,
            background: 'var(--ant-color-fill-quaternary)',
            borderRadius: 4,
            fontSize: 10,
            fontFamily: 'monospace',
            maxHeight: 200,
            overflow: 'auto'
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {detailContent}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--ant-color-border)',
        background: 'var(--ant-color-bg-container)',
        transition: 'background 0.2s'
      }}
    >
      {/* 组头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          cursor: isMerged ? 'pointer' : 'default'
        }}
        onClick={() => isMerged && onToggleGroup(group.id)}
      >
        <Space size={6} style={{ flex: 1 }}>
          {/* 展开/收起图标（仅合并事件显示） */}
          {isMerged && (
            <span style={{ fontSize: 10, color: 'var(--ant-color-text-tertiary)' }}>
              {isExpanded ? <DownOutlined /> : <RightOutlined />}
            </span>
          )}
          
          {/* 来源图标 */}
          <span style={{ fontSize: 12 }}>{getSourceIcon(group.source)}</span>
          
          {/* 来源标签 */}
          <Tag 
            color={getEventColor(group.source, group.type)} 
            style={{ margin: 0, fontSize: 9, padding: '0 4px' }}
          >
            {group.source}
          </Tag>
          
          {/* 事件类型 */}
          <Text style={{ fontSize: 11 }}>
            {formatEventType(group.type)}
          </Text>
          
          {/* 合并计数 */}
          {isMerged && (
            <Tag color="blue" style={{ margin: 0, fontSize: 9, padding: '0 4px' }}>
              ×{group.count}
            </Tag>
          )}
        </Space>
        
        {/* 时间 */}
        <Text type="secondary" style={{ fontSize: 9, whiteSpace: 'nowrap', marginLeft: 8 }}>
          {formatTimestamp(group.lastTimestamp)}
        </Text>
      </div>

      {/* 单个事件的详情（非合并事件直接显示） */}
      {!isMerged && renderEventDetail(group.events[0])}

      {/* 合并事件收起时显示时间范围 */}
      {isMerged && !isExpanded && (
        <div style={{ 
          marginTop: 8, 
          marginLeft: 20,
          fontSize: 10,
          color: 'var(--ant-color-text-tertiary)'
        }}>
          <Space size={4} split="|">
            <span>
              {formatTimestamp(group.firstTimestamp)} ~ {formatTimestamp(group.lastTimestamp)}
            </span>
            <span>
              持续 {((group.lastTimestamp - group.firstTimestamp) / 1000).toFixed(1)}秒
            </span>
          </Space>
        </div>
      )}

      {/* 展开的事件列表（合并事件） */}
      {isMerged && isExpanded && (
        <div style={{ marginTop: 12, marginLeft: 20 }}>
          {group.events.map((event, idx) => (
            <div
              key={event.id}
              style={{
                padding: '8px',
                marginBottom: idx < group.events.length - 1 ? 8 : 0,
                background: 'var(--ant-color-fill-quaternary)',
                borderRadius: 4,
                borderLeft: '2px solid var(--ant-color-primary)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 10 }}>#{idx + 1}</Text>
                <Text type="secondary" style={{ fontSize: 9 }}>
                  {formatTimestamp(event.timestamp)}
                </Text>
              </div>
              
              {/* 事件消息 */}
              {event.message && (
                <Text style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>
                  {event.message}
                </Text>
              )}
              
              {/* 事件详情 */}
              {renderEventDetail(event)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export const EventLogPanel: React.FC = () => {
  const chatEvents = useChatStore((state) => state.chatEvents);
  const workflowExecution = useChatStore((state) => state.workflowExecution);
  const listEndRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('all'); // all, important, errors
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // 展开/收起所有组
  const toggleAllGroups = () => {
    if (expandedGroups.size > 0) {
      // 如果有展开的，就全部收起
      setExpandedGroups(new Set());
    } else {
      // 否则全部展开（只展开合并的组）
      const mergedGroupIds = filteredGroups
        .filter(g => g.count > 1)
        .map(g => g.id);
      setExpandedGroups(new Set(mergedGroupIds));
    }
  };

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

  // 定义需要特殊处理的高频事件
  const HIGH_FREQUENCY_EVENTS = new Set([
    'agent:stream-text',
    'agent:tool-input-progress',
    'agent:thinking'
  ]);

  // 根据事件类型返回合并时间阈值
  const getTimeThreshold = (eventType: string): number => {
    if (HIGH_FREQUENCY_EVENTS.has(eventType)) {
      return 30000; // 30秒 - 高频事件使用更长窗口
    }
    return 2000; // 2秒 - 默认阈值
  };

  // 合并连续相同事件的核心逻辑（使用useMemo优化）
  const groupedEvents = useMemo(() => {
    const groups: EventGroup[] = [];
    let currentGroup: EventGroup | null = null;

    chatEvents.forEach((event, index) => {
      const eventKey = `${event.source}-${event.type}`;
      
      // 判断是否应该合并到当前组
      const shouldMerge = currentGroup && 
        currentGroup.type === event.type && 
        currentGroup.source === event.source &&
        // 根据事件类型使用不同的时间阈值
        (event.timestamp - currentGroup.lastTimestamp < getTimeThreshold(event.type));

      if (shouldMerge) {
        // 合并到当前组
        currentGroup!.count++;
        currentGroup!.events.push(event);
        currentGroup!.lastTimestamp = event.timestamp;
      } else {
        // 创建新组
        currentGroup = {
          id: `group-${index}`,
          type: event.type,
          source: event.source,
          count: 1,
          events: [event],
          firstTimestamp: event.timestamp,
          lastTimestamp: event.timestamp,
        };
        groups.push(currentGroup);
      }
    });

    return groups;
  }, [chatEvents]);

  // 过滤事件组
  const filteredGroups = useMemo(() => {
    let groups = groupedEvents;

    // 根据过滤器过滤
    if (filter === 'important') {
      groups = groups.filter(g => 
        g.type.includes('error') || 
        g.type.includes('complete') ||
        g.type.includes('tool-call') ||
        g.type.includes('workflow') ||
        g.source === 'user'
      );
    } else if (filter === 'errors') {
      groups = groups.filter(g => g.type.includes('error'));
    }

    return groups;
  }, [groupedEvents, filter]);

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

  const formatEventType = (type: string) => {
    // 简化事件类型显示
    const typeMap: Record<string, string> = {
      'agent:thinking': '思考中',
      'agent:stream-text': '生成文本',
      'agent:stream-finish': '完成生成',
      'agent:tool-call': '调用工具',
      'agent:tool-result': '工具结果',
      'agent:tool-error': '工具错误',
      'agent:tool-input-start': '开始接收参数',
      'agent:tool-input-progress': '接收参数中',
      'agent:tool-input-complete': '参数接收完成',
      'agent:start': '开始执行',
      'agent:complete': '执行完成',
      'agent:error': '执行错误',
    };
    return typeMap[type] || type;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const toggleEventExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
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
              <Tag color="blue">{chatEvents.length} 事件</Tag>
              <Tag color="green">{filteredGroups.length} 组</Tag>
              {groupedEvents.length < chatEvents.length && (
                <Tag color="purple">已合并 {chatEvents.length - groupedEvents.length}</Tag>
              )}
            </Space>
            {workflowExecution && (
              <Tag color={workflowExecution.status === 'running' ? 'processing' : workflowExecution.status === 'completed' ? 'success' : 'error'}>
                {workflowExecution.status === 'running' ? '运行中' : workflowExecution.status === 'completed' ? '已完成' : '失败'}
              </Tag>
            )}
          </Space>
          
          {/* 控制栏 */}
          <Space size={8} style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
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
              <Button 
                size="small" 
                onClick={toggleAllGroups}
              >
                {expandedGroups.size > 0 ? '全部收起' : '全部展开'}
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
        {filteredGroups.map(group => (
          <EventGroupItem
            key={group.id}
            group={group}
            isExpanded={expandedGroups.has(group.id)}
            expandedEvents={expandedEvents}
            onToggleGroup={toggleGroupExpand}
            onToggleEvent={toggleEventExpand}
            getSourceIcon={getSourceIcon}
            getEventColor={getEventColor}
            formatEventType={formatEventType}
            formatTimestamp={formatTimestamp}
          />
        ))}
        <div ref={listEndRef} />
      </div>
    </Card>
  );
};
