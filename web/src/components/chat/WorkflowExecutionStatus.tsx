import React, { useState, useEffect, useRef } from 'react';
import { Card, Timeline, Tag, Space, Typography, Progress, Button, Divider, Alert } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  SyncOutlined,
  BulbOutlined,
  ToolOutlined,
  CompressOutlined,
  ExpandOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Workflow, ExecutionEvent, IterationData } from '../../types';
import { WorkflowDiagram } from './WorkflowDiagram';
import { EventDetailFormatter } from './EventDetailFormatter';
import { WorkflowSummary } from './WorkflowSummary';

const { Text } = Typography;

interface WorkflowExecutionStatusProps {
  workflow: Workflow;
  status: 'running' | 'completed' | 'failed';
  currentAgent?: string;
  events: ExecutionEvent[];
  completedAgents: string[];
  failedAgents: string[];
  startTime: number;
  iterations: Record<string, IterationData[]>;  // 按迭代组织的数据
}

export const WorkflowExecutionStatus: React.FC<WorkflowExecutionStatusProps> = ({
  workflow,
  status,
  currentAgent,
  events,
  completedAgents,
  failedAgents,
  startTime,
  iterations,
}) => {
  console.log('🔍 WorkflowExecutionStatus render:', {
    workflowId: workflow.id,
    totalEvents: events.length,
    events: events.map(e => ({ type: e.type, agentId: e.agentId })),
    currentAgent,
    completedAgents,
    failedAgents
  });

  // 状态：控制展开的 agent
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [compactMode, setCompactMode] = useState(false);  // 紧凑模式
  const agentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 自动展开当前执行中的 agent
  useEffect(() => {
    if (currentAgent && !activeKeys.includes(currentAgent)) {
      setActiveKeys(prev => [...prev, currentAgent]);
      
      // 延迟滚动，等待展开动画完成
      setTimeout(() => {
        agentRefs.current[currentAgent]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        });
      }, 300);
    }
  }, [currentAgent]);

  const totalAgents = workflow.agentGraph.length;
  const progress = Math.round(((completedAgents.length + failedAgents.length) / totalAgents) * 100);
  const duration = Math.round((Date.now() - startTime) / 1000);

  const getStatusIcon = (agentId: string) => {
    if (failedAgents.includes(agentId)) {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    }
    if (completedAgents.includes(agentId)) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
    if (currentAgent === agentId) {
      return <SyncOutlined spin style={{ color: '#1890ff' }} />;
    }
    return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
  };

  const getStatusColor = () => {
    if (status === 'failed') return 'error';
    if (status === 'completed') return 'success';
    return 'processing';
  };


  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Space>
          <SyncOutlined spin={status === 'running'} />
          <Text>工作流执行中...</Text>
          <Tag color={getStatusColor()}>
            {status === 'running' ? '执行中' : status === 'completed' ? '已完成' : '失败'}
          </Tag>
        </Space>
          <Button 
            type="text" 
            size="small"
            icon={compactMode ? <ExpandOutlined /> : <CompressOutlined />}
            onClick={() => setCompactMode(!compactMode)}
          >
            {compactMode ? '展开详情' : '紧凑模式'}
          </Button>
        </div>
      }
      style={{ marginTop: 16, marginBottom: 16 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Workflow 流程图 - 紧凑模式下隐藏 */}
        {!compactMode && (
          <WorkflowDiagram
            workflow={workflow}
            currentAgent={currentAgent}
            completedAgents={completedAgents}
            failedAgents={failedAgents}
          />
        )}
        
        <div>
          <Text type="secondary">进度: </Text>
          <Progress percent={progress} status={status === 'failed' ? 'exception' : status === 'running' ? 'active' : 'success'} />
        </div>
        
        <div>
          <Text type="secondary">已执行时间: {duration}秒</Text>
        </div>

        {/* Workflow 执行总结 - 在完成或失败时显示 */}
        {(status === 'completed' || status === 'failed') && (
          <WorkflowSummary
            workflow={workflow}
            status={status}
            events={events}
            completedAgents={completedAgents}
            failedAgents={failedAgents}
            startTime={startTime}
            endTime={Date.now()}
          />
        )}

        <Timeline
          items={workflow.agentGraph.map((node) => {
            // 直接使用 iterations 数据
            const nodeIterations = iterations[node.id] || [];
            
            // 获取 agent:complete 事件以显示 summary
            const completeEvent = events.find(e => e.nodeId === node.id && e.type === 'agent:complete');
            
            const isRunning = currentAgent === node.id;
            const isCompleted = completedAgents.includes(node.id);
            const isFailed = failedAgents.includes(node.id);

            return {
              icon: getStatusIcon(node.id),
              children: (
                <div ref={el => { agentRefs.current[node.id] = el; }}>
                  <Space>
                    <Text strong>{node.name}</Text>
                    <Tag color={node.type === 'browser' ? 'blue' : node.type === 'computer' ? 'green' : node.type === 'code' ? 'purple' : 'orange'}>
                      {node.type}
                    </Tag>
                  </Space>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">{node.desc}</Text>
                  </div>
                  
                  {/* Agent 状态标签 */}
                  {isRunning && (
                    <div style={{ marginTop: 8 }}>
                      <Tag icon={<SyncOutlined spin />} color="processing">
                        执行中...
                      </Tag>
                    </div>
                  )}
                  {isCompleted && (
                    <div style={{ marginTop: 8 }}>
                      <Tag icon={<CheckCircleOutlined />} color="success">
                        已完成
                      </Tag>
                    </div>
                  )}
                  {isFailed && (
                    <div style={{ marginTop: 8 }}>
                      <Tag icon={<CloseCircleOutlined />} color="error">
                        执行失败
                      </Tag>
                    </div>
                  )}

                  {/* 按迭代显示 ReAct 循环 - 卡片式 */}
                  {nodeIterations.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      {nodeIterations.map((iteration) => (
                        <Card 
                          key={iteration.iteration} 
                          size="small"
                          title={<Text strong style={{ fontSize: 14 }}>Step {iteration.iteration}</Text>}
                          style={{ 
                            marginBottom: 16,
                            border: '2px solid var(--ant-color-border)',
                            borderRadius: 8,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          {/* 思考过程 */}
                          {iteration.thinkingText && (
                            <>
                                      <Space size={4}>
                                <BulbOutlined style={{ color: 'var(--ant-color-primary)' }} />
                                <Text strong style={{ fontSize: 13 }}>思考过程</Text>
                                      </Space>
                              <div
                                style={{ 
                                  marginTop: 8, 
                                  marginBottom: 0,
                                  marginLeft: 24,  // 增加左侧边距，避免被图标遮挡
                                  fontSize: 12, 
                                  background: '#f0f5ff',
                                  padding: 12,
                                  borderRadius: 4,
                                  lineHeight: 1.6,
                                  overflowX: 'auto',
                                  maxWidth: 'calc(100% - 24px)'  // 减去左侧边距
                                }}
                                className="markdown-content"
                              >
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    // 自定义列表样式，增加左侧边距
                                    ul: ({node, ...props}) => <ul style={{ 
                                      marginLeft: 20,
                                      paddingLeft: 20,
                                      marginBottom: 8
                                    }} {...props} />,
                                    ol: ({node, ...props}) => <ol style={{ 
                                      marginLeft: 20,
                                      paddingLeft: 20,
                                      marginBottom: 8
                                    }} {...props} />,
                                    li: ({node, ...props}) => <li style={{ 
                                      marginBottom: 4,
                                      lineHeight: 1.6
                                    }} {...props} />,
                                    p: ({node, ...props}) => <p style={{ 
                                      marginBottom: 8,
                                      lineHeight: 1.6
                                    }} {...props} />,
                                    h1: ({node, ...props}) => <h1 style={{ fontSize: 16, fontWeight: 600, marginTop: 12, marginBottom: 8 }} {...props} />,
                                    h2: ({node, ...props}) => <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 10, marginBottom: 6 }} {...props} />,
                                    h3: ({node, ...props}) => <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 8, marginBottom: 4 }} {...props} />,
                                  }}
                                >
                                  {iteration.thinkingText}
                                </ReactMarkdown>
                              </div>
                              
                              {iteration.toolCalls.length > 0 && <Divider style={{ margin: '12px 0' }} />}
                            </>
                          )}
                          
                          {/* 工具调用和结果 */}
                          {iteration.toolCalls.map((toolCall, tcIdx) => (
                            <div key={tcIdx}>
                              {tcIdx > 0 && <Divider style={{ margin: '12px 0' }} />}
                              
                              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                {/* 工具调用 */}
                                <div>
                                  <Space size={4}>
                                    <ToolOutlined style={{ color: '#13c2c2' }} />
                                    <Text strong style={{ fontSize: 12 }}>
                                      调用工具: {toolCall.toolName}
                                    </Text>
                                  </Space>
                                  <EventDetailFormatter 
                                    eventType="agent:tool-call" 
                                    data={{ toolName: toolCall.toolName, input: toolCall.input }} 
                                  />
                                </div>
                                
                                {/* 工具结果或错误 */}
                                {(toolCall.result || toolCall.error) && (
                                  <div>
                                    <Space size={4}>
                                      {toolCall.error ? (
                                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                                      ) : (
                                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                      )}
                                      <Text strong style={{ fontSize: 12 }}>
                                        {toolCall.error ? '工具错误' : '工具结果'}
                                      </Text>
                                    </Space>
                                    <EventDetailFormatter 
                                      eventType={toolCall.error ? "agent:tool-error" : "agent:tool-result"} 
                                      data={{ toolName: toolCall.toolName, result: toolCall.result, error: toolCall.error }} 
                                    />
                                  </div>
                                )}
                              </Space>
                            </div>
                          ))}
                        </Card>
                      ))}
                      
                      {/* Agent 完成后的 summary（任务总结文本） */}
                      {completeEvent && completeEvent.data?.summary && (
                        <Alert
                          type="success"
                          icon={<CheckCircleOutlined />}
                          message={<Text strong>任务完成总结</Text>}
                          description={
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                              <div style={{ 
                                fontSize: 13, 
                                overflowX: 'auto', 
                                maxWidth: '100%',
                                marginLeft: 0  // 确保没有额外左边距
                              }} 
                              className="markdown-content">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    // 自定义列表样式
                                    ul: ({node, ...props}) => <ul style={{ 
                                      marginLeft: 20,
                                      paddingLeft: 20,
                                      marginBottom: 8
                                    }} {...props} />,
                                    ol: ({node, ...props}) => <ol style={{ 
                                      marginLeft: 20,
                                      paddingLeft: 20,
                                      marginBottom: 8
                                    }} {...props} />,
                                    li: ({node, ...props}) => <li style={{ 
                                      marginBottom: 4,
                                      lineHeight: 1.6
                                    }} {...props} />,
                                    p: ({node, ...props}) => <p style={{ 
                                      marginBottom: 8,
                                      lineHeight: 1.6
                                    }} {...props} />,
                                    h1: ({node, ...props}) => <h1 style={{ fontSize: 16, fontWeight: 600, marginTop: 12, marginBottom: 8 }} {...props} />,
                                    h2: ({node, ...props}) => <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 10, marginBottom: 6 }} {...props} />,
                                    h3: ({node, ...props}) => <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 8, marginBottom: 4 }} {...props} />,
                                  }}
                                >
                                  {completeEvent.data.summary}
                                </ReactMarkdown>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                📊 执行统计: 用时 {Math.round((completeEvent.data?.duration || 0) / 1000)}秒, {completeEvent.data?.iterations || '?'} 次迭代
                              </Text>
                            </Space>
                          }
                          style={{ marginTop: 12 }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ),
            };
          })}
        />
      </Space>
    </Card>
  );
};

