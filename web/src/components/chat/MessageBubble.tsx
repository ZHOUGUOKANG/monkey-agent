import React from 'react';
import { Avatar, Card, Typography, Tag, Space, Spin } from 'antd';
import { 
  UserOutlined, 
  RobotOutlined, 
  ThunderboltOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BulbOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs from 'dayjs';
import type { Message } from '../../types';
import { ArtifactViewer } from '../artifact';

const { Paragraph, Text } = Typography;

interface MessageBubbleProps {
  message: Message;
  onCompileError?: (artifactId: string, error: string) => void;
}

// 辅助函数：检测内容是否为 Markdown
const isMarkdown = (content: string): boolean => {
  // 检测 Markdown 特征
  return (
    content.includes('#') ||      // 标题
    content.includes('**') ||     // 粗体
    content.includes('__') ||     // 粗体
    content.includes('*') ||      // 斜体/列表
    content.includes('- ') ||     // 列表
    content.includes('```') ||    // 代码块
    content.includes('[') ||      // 链接
    content.includes('|')         // 表格
  );
};

// 辅助函数：格式化 JSON 显示
const formatJSON = (data: any): string => {
  if (typeof data === 'string') {
    try {
      // 尝试解析字符串为 JSON
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return data;
    }
  }
  return JSON.stringify(data, null, 2);
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onCompileError }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // 系统消息（简单状态或 loading）的特殊样式
  if (isSystem && !message.agentStatus) {
    return (
      <div className="message system" style={{ 
        marginLeft: '48px', 
        marginBottom: '8px',
        opacity: 0.85 
      }}>
        <Card
          variant="borderless"
          size="small"
          style={{ 
            maxWidth: '80%',
            background: message.isLoading ? 'rgba(24, 144, 255, 0.05)' : 'var(--ant-color-fill-quaternary)',
            border: message.isLoading ? '1px solid rgba(24, 144, 255, 0.2)' : '1px solid var(--ant-color-border-secondary)',
            transition: 'all 0.3s ease'
          }}
        >
          <Space>
            {message.isLoading ? (
              <Spin indicator={<LoadingOutlined style={{ fontSize: 14, color: '#1890ff' }} spin />} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            <Text style={{ fontSize: 13 }}>{message.content}</Text>
          </Space>
          
          <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
            {dayjs(message.timestamp).format('HH:mm:ss')}
          </Text>
        </Card>
      </div>
    );
  }

  // 系统消息（Agent 状态）的特殊样式
  if (isSystem && message.agentStatus) {
    const { phase, toolName, details } = message.agentStatus;
    
    const getPhaseIcon = () => {
      switch (phase) {
        case 'thinking':
          return <BulbOutlined style={{ color: '#1890ff' }} />;
        case 'reflection':
          return <BulbOutlined style={{ color: '#722ed1' }} spin />;
        case 'tool-call':
          return <ToolOutlined style={{ color: '#13c2c2' }} />;
        case 'tool-result':
          return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
        case 'complete':
          return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
        case 'compressed':
          return <ThunderboltOutlined style={{ color: '#fa8c16' }} />;
        case 'warning':
          return <ThunderboltOutlined style={{ color: '#faad14' }} />;
        case 'error':
          return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
        default:
          return <ThunderboltOutlined />;
      }
    };

    const getPhaseColor = () => {
      switch (phase) {
        case 'thinking': return 'blue';
        case 'reflection': return 'purple';
        case 'tool-call': return 'cyan';
        case 'tool-result': return 'green';
        case 'complete': return 'success';
        case 'compressed': return 'orange';
        case 'warning': return 'gold';
        case 'error': return 'red';
        default: return 'default';
      }
    };

    return (
      <div className="message system" style={{ 
        marginLeft: '48px', 
        marginBottom: '8px',
        opacity: 0.85 
      }}>
        <Card
          variant="borderless"
          size="small"
          style={{ 
            maxWidth: '80%',
            background: 'var(--ant-color-fill-quaternary)',
            border: '1px solid var(--ant-color-border-secondary)'
          }}
        >
          <Space>
            {getPhaseIcon()}
            <Text style={{ fontSize: 13 }}>{message.content}</Text>
            {toolName && (
              <Tag color={getPhaseColor()} style={{ fontSize: 11 }}>
                {toolName}
              </Tag>
            )}
          </Space>
          
          {details && (
            <div style={{ marginTop: 8 }}>
              <Paragraph
                style={{ 
                  fontSize: 11,
                  marginBottom: 0,
                  padding: 8,
                  background: 'var(--ant-color-bg-container)',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
                ellipsis={{ rows: 5, expandable: true, symbol: '展开' }}
              >
                {formatJSON(details)}
              </Paragraph>
            </div>
          )}
          
          <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
            {dayjs(message.timestamp).format('HH:mm:ss')}
          </Text>
        </Card>
      </div>
    );
  }

  // 普通消息（用户或 AI）
  return (
    <div className={`message ${isUser ? 'user' : 'ai'}`}>
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{ backgroundColor: isUser ? '#1677ff' : '#52c41a', flexShrink: 0 }}
      />
      <Card
        variant="borderless"
        size="small"
        style={{ maxWidth: message.artifact ? '90%' : '70%', minWidth: '200px' }}
      >
        {/* 智能渲染消息内容 */}
        {isMarkdown(message.content) ? (
          <div style={{ marginBottom: 8 }} className="markdown-content">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                // 自定义标题样式
                h1: ({node, ...props}) => <h1 style={{ 
                  fontSize: 22, 
                  fontWeight: 600, 
                  marginTop: 16, 
                  marginBottom: 12,
                  borderBottom: '2px solid var(--ant-color-border)',
                  paddingBottom: 8
                }} {...props} />,
                h2: ({node, ...props}) => <h2 style={{ 
                  fontSize: 18, 
                  fontWeight: 600, 
                  marginTop: 14, 
                  marginBottom: 10,
                  borderBottom: '1px solid var(--ant-color-border-secondary)',
                  paddingBottom: 6
                }} {...props} />,
                h3: ({node, ...props}) => <h3 style={{ 
                  fontSize: 16, 
                  fontWeight: 600, 
                  marginTop: 12, 
                  marginBottom: 8 
                }} {...props} />,
                
                // 自定义段落样式
                p: ({node, ...props}) => <p style={{ 
                  marginBottom: 12, 
                  lineHeight: 1.7,
                  fontSize: 14
                }} {...props} />,
                
                // 自定义列表样式 - 增加左侧边距
                ul: ({node, ...props}) => <ul style={{ 
                  marginLeft: 24,
                  marginBottom: 12,
                  paddingLeft: 20,
                  listStyleType: 'disc'
                }} {...props} />,
                ol: ({node, ...props}) => <ol style={{ 
                  marginLeft: 24,
                  marginBottom: 12,
                  paddingLeft: 20
                }} {...props} />,
                li: ({node, ...props}) => <li style={{ 
                  marginBottom: 6,
                  lineHeight: 1.7,
                  fontSize: 14
                }} {...props} />,
                
                // 自定义引用样式
                blockquote: ({node, ...props}) => <blockquote style={{
                  borderLeft: '4px solid var(--ant-color-primary)',
                  paddingLeft: 16,
                  marginLeft: 0,
                  marginBottom: 12,
                  color: 'var(--ant-color-text-secondary)',
                  fontStyle: 'italic'
                }} {...props} />,
                
                // 自定义表格样式
                table: ({node, ...props}) => <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: 12
                }} {...props} />,
                th: ({node, ...props}) => <th style={{
                  border: '1px solid var(--ant-color-border)',
                  padding: '8px 12px',
                  background: 'var(--ant-color-fill-quaternary)',
                  fontWeight: 600,
                  textAlign: 'left'
                }} {...props} />,
                td: ({node, ...props}) => <td style={{
                  border: '1px solid var(--ant-color-border)',
                  padding: '8px 12px'
                }} {...props} />,
                
                // 自定义代码块样式
                code: ({node, className, children, ...props}: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  return isInline ? 
                    <code style={{ 
                      background: 'var(--ant-color-fill-quaternary)', 
                      padding: '2px 6px', 
                      borderRadius: 3,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      color: '#d63384'
                    }} {...props}>{children}</code> :
                    <code style={{ 
                      display: 'block',
                      background: 'var(--ant-color-fill-quaternary)', 
                      padding: 12, 
                      borderRadius: 4,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      overflowX: 'auto',
                      marginBottom: 12
                    }} className={className} {...props}>{children}</code>;
                },
                
                // 自定义分割线样式
                hr: ({node, ...props}) => <hr style={{
                  border: 'none',
                  borderTop: '1px solid var(--ant-color-border)',
                  marginTop: 16,
                  marginBottom: 16
                }} {...props} />,
                
                // 自定义链接样式
                a: ({node, ...props}) => <a style={{
                  color: 'var(--ant-color-primary)',
                  textDecoration: 'none'
                }} {...props} />
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <Paragraph style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Paragraph>
        )}
        
        {/* Render Artifact if present */}
        {message.artifact && (
          <div style={{ marginTop: 16, height: '600px' }}>
            <ArtifactViewer artifact={message.artifact} onCompileError={onCompileError} />
          </div>
        )}
        
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(message.timestamp).format('HH:mm:ss')}
        </Text>
      </Card>
    </div>
  );
};

