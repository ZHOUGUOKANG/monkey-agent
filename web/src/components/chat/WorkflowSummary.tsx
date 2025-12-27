import React from 'react';
import { Alert, Space, Typography, Table, Descriptions, Tag, message, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  FileOutlined,
  LinkOutlined
} from '@ant-design/icons';
import type { Workflow, ExecutionEvent } from '../../types';

const { Text } = Typography;

interface WorkflowSummaryProps {
  workflow: Workflow;
  status: 'completed' | 'failed';
  events: ExecutionEvent[];
  completedAgents: string[];
  failedAgents: string[];
  startTime: number;
  endTime: number;
}

// 格式化时长
const formatDuration = (ms: number): string => {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}分${secs}秒`;
};

// 从事件中提取 Agent 统计信息
const extractAgentSummary = (events: ExecutionEvent[], nodeId: string) => {
  const agentEvents = events.filter(e => e.nodeId === nodeId);
  
  // 计算耗时
  const startEvent = agentEvents.find(e => e.type === 'agent:start');
  const endEvent = agentEvents.find(e => e.type === 'agent:complete' || e.type === 'agent:error');
  const duration = endEvent && startEvent 
    ? endEvent.timestamp - startEvent.timestamp 
    : 0;
  
  // 统计工具调用
  const toolCalls = agentEvents
    .filter(e => e.type === 'agent:tool-call')
    .map(e => e.data?.toolName);
  const toolCallSummary = Object.entries(
    toolCalls.reduce((acc, tool) => {
      acc[tool] = (acc[tool] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([tool, count]) => `${tool}(${count})`).join(', ');
  
  // 获取迭代次数
  const completeEvent = agentEvents.find(e => e.type === 'agent:complete');
  const iterations = completeEvent?.data?.iterations || 0;
  
  // 判断状态
  const isCompleted = agentEvents.some(e => e.type === 'agent:complete');
  const isFailed = agentEvents.some(e => e.type === 'agent:error');
  
  return {
    duration: formatDuration(duration),
    durationMs: duration,
    toolCalls: toolCallSummary || '无',
    iterations,
    status: isFailed ? 'failed' : isCompleted ? 'success' : 'unknown'
  };
};

// 从事件中提取关键产出物
const extractKeyOutputs = (events: ExecutionEvent[]) => {
  const generatedFiles: string[] = [];
  const visitedUrls: string[] = [];
  const executedCommands: string[] = [];
  
  events.forEach(event => {
    if (event.type === 'agent:tool-call') {
      const toolName = event.data?.toolName;
      const input = event.data?.input;
      
      if (toolName === 'writeFile' && input?.path) {
        generatedFiles.push(input.path);
      } else if (toolName === 'navigate' && input?.url) {
        visitedUrls.push(input.url);
      } else if (toolName === 'execCommand' && input?.command) {
        executedCommands.push(input.command);
      }
    } else if (event.type === 'agent:tool-result') {
      // 从 tool result 中提取文件路径（有些工具返回完整路径）
      const toolName = event.data?.toolName;
      const result = event.data?.result;
      
      if (toolName === 'writeFile' && result?.path) {
        // 如果结果中有完整路径，替换之前的相对路径
        const index = generatedFiles.findIndex(f => f.endsWith(result.path.split('/').pop()));
        if (index !== -1) {
          generatedFiles[index] = result.path;
        }
      }
    }
  });
  
  return { generatedFiles, visitedUrls, executedCommands };
};

export const WorkflowSummary: React.FC<WorkflowSummaryProps> = ({
  workflow,
  status,
  events,
  completedAgents,
  failedAgents,
  startTime,
  endTime,
}) => {
  const totalAgents = workflow.agentGraph.length;
  const totalDuration = endTime - startTime;
  const { generatedFiles, visitedUrls, executedCommands } = extractKeyOutputs(events);
  
  // 构建 Agent 统计表数据
  const agentSummaries = workflow.agentGraph.map(node => {
    const summary = extractAgentSummary(events, node.id);
    return {
      key: node.id,
      name: node.name,
      type: node.type,
      ...summary
    };
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* 整体状态摘要 */}
      <Alert
        type={status === 'completed' ? 'success' : 'error'}
        message={
          <Space>
            {status === 'completed' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            <Text strong>
              Workflow {status === 'completed' ? '执行成功' : '执行失败'}
            </Text>
          </Space>
        }
        description={
          <div>
            <Text>共执行 {totalAgents} 个 Agent，{completedAgents.length} 个成功，{failedAgents.length} 个失败</Text>
            <br />
            <Text type="secondary">总耗时: {formatDuration(totalDuration)}</Text>
          </div>
        }
      />

      {/* Agent 执行统计表 */}
      <Table
        size="small"
        dataSource={agentSummaries}
        columns={[
          { 
            title: 'Agent', 
            dataIndex: 'name', 
            key: 'name',
            width: '30%'
          },
          { 
            title: '类型', 
            dataIndex: 'type', 
            key: 'type',
            width: '10%',
            render: (type: string) => (
              <Tag color={type === 'browser' ? 'blue' : type === 'computer' ? 'green' : type === 'code' ? 'purple' : 'orange'}>
                {type}
              </Tag>
            )
          },
          { 
            title: '状态', 
            dataIndex: 'status', 
            key: 'status',
            width: '10%',
            render: (statusValue: string) => (
              <Tag color={statusValue === 'success' ? 'success' : 'error'}>
                {statusValue === 'success' ? '✅ 成功' : '❌ 失败'}
              </Tag>
            )
          },
          { 
            title: '耗时', 
            dataIndex: 'duration', 
            key: 'duration',
            width: '10%'
          },
          { 
            title: '工具调用', 
            dataIndex: 'toolCalls', 
            key: 'toolCalls',
            width: '30%',
            ellipsis: true
          },
          { 
            title: '迭代次数', 
            dataIndex: 'iterations', 
            key: 'iterations',
            width: '10%',
            align: 'center'
          },
        ]}
        pagination={false}
      />

      {/* 关键产出物 */}
      {(generatedFiles.length > 0 || visitedUrls.length > 0 || executedCommands.length > 0) && (
        <Descriptions title="关键产出" size="small" column={1} bordered>
          {generatedFiles.length > 0 && (
            <Descriptions.Item label="生成文件">
              {generatedFiles.map((file, idx) => {
                // 提取文件名用于显示
                const fileName = file.split('/').pop() || file;
                const isFullPath = file.includes('/');
                
                return (
                  <Tooltip key={idx} title={isFullPath ? `点击复制完整路径: ${file}` : '相对路径，点击复制'}>
                    <Tag 
                      icon={<FileOutlined />} 
                      style={{ marginBottom: 4, cursor: 'pointer' }}
                      onClick={() => {
                        navigator.clipboard.writeText(file);
                        message.success(`已复制文件路径: ${file}`);
                      }}
                    >
                      {fileName}
                    </Tag>
                  </Tooltip>
                );
              })}
            </Descriptions.Item>
          )}
          {visitedUrls.length > 0 && (
            <Descriptions.Item label="访问链接">
              {visitedUrls.slice(0, 3).map((url, idx) => (
                <Tag 
                  key={idx} 
                  icon={<LinkOutlined />} 
                  style={{ marginBottom: 4, cursor: 'pointer' }}
                  onClick={() => {
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  {url.length > 50 ? url.substring(0, 50) + '...' : url}
                </Tag>
              ))}
              {visitedUrls.length > 3 && (
                <Text type="secondary"> 等 {visitedUrls.length} 个链接</Text>
              )}
            </Descriptions.Item>
          )}
          {executedCommands.length > 0 && (
            <Descriptions.Item label="执行命令">
              {executedCommands.map((cmd, idx) => (
                <Tag 
                  key={idx} 
                  style={{ marginBottom: 4, fontFamily: 'monospace', cursor: 'pointer' }}
                  onClick={() => {
                    navigator.clipboard.writeText(cmd);
                    message.success(`已复制命令: ${cmd}`);
                  }}
                >
                  {cmd.length > 40 ? cmd.substring(0, 40) + '...' : cmd}
                </Tag>
              ))}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}

      {/* 失败原因（如果有） */}
      {failedAgents.length > 0 && (
        <Alert
          type="error"
          message="部分 Agent 执行失败"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              {failedAgents.map(agentId => {
                const node = workflow.agentGraph.find(n => n.id === agentId);
                const errorEvent = events.find(
                  e => e.nodeId === agentId && e.type === 'agent:error'
                );
                return (
                  <li key={agentId}>
                    <Text strong>{node?.name || agentId}</Text>: {errorEvent?.data?.error || '未知错误'}
                  </li>
                );
              })}
            </ul>
          }
        />
      )}
    </Space>
  );
};

