import React, { memo } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';

interface ToolInputProgressProps {
  toolName: string;
  charCount: number;
  fullContent: string; // 完整累积内容
  status: 'receiving' | 'complete';
  duration?: number;
  compact?: boolean;
}

export const ToolInputProgress = memo<ToolInputProgressProps>(({
  toolName,
  charCount,
  fullContent,
  status,
  duration,
  compact = false
}) => {
  return (
    <div
      style={{
        padding: compact ? '8px 12px' : '12px 16px',
        marginTop: compact ? 8 : 0,
        marginLeft: compact ? 20 : 0,
        background: status === 'receiving' 
          ? 'rgba(24, 144, 255, 0.05)' 
          : 'rgba(82, 196, 26, 0.05)',
        border: `1px solid ${status === 'receiving' ? '#91d5ff' : '#b7eb8f'}`,
        borderRadius: '8px',
        marginBottom: compact ? 0 : '8px',
        transition: 'all 0.3s ease'
      }}
    >
      {/* 标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {status === 'receiving' ? (
          <Spin indicator={<LoadingOutlined style={{ fontSize: 14, color: '#1890ff' }} spin />} />
        ) : (
          <CheckCircleOutlined style={{ fontSize: 14, color: '#52c41a' }} />
        )}
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 500,
          color: 'var(--ant-color-text)'
        }}>
          {status === 'receiving' ? '正在接收' : '已接收'} <code>{toolName}</code> 的参数
        </span>
      </div>
      
      {/* 进度信息 */}
      <div style={{ 
        fontSize: '12px', 
        color: 'var(--ant-color-text-secondary)',
        marginBottom: fullContent ? '8px' : '0'
      }}>
        已接收 <strong>{charCount.toLocaleString()}</strong> 字符
        {duration && (
          <span style={{ marginLeft: '8px', color: '#52c41a' }}>
            (耗时 {(duration / 1000).toFixed(1)}秒)
          </span>
        )}
      </div>
      
      {/* 参数内容 - 显示完整累积内容 */}
      {fullContent && (
        <div
          style={{
            fontSize: '11px',
            fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
            color: 'var(--ant-color-text-tertiary)',
            background: 'var(--ant-color-bg-container)',
            padding: '8px 10px',
            borderRadius: '4px',
            border: '1px solid var(--ant-color-border-secondary)',
            maxHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap'
          }}
        >
          {fullContent}
          {status === 'receiving' && (
            <span style={{ 
              animation: 'blink 1s infinite',
              marginLeft: '2px' 
            }}>▌</span>
          )}
        </div>
      )}
      
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只有当关键属性变化时才重新渲染
  return (
    prevProps.toolName === nextProps.toolName &&
    prevProps.charCount === nextProps.charCount &&
    prevProps.status === nextProps.status &&
    prevProps.duration === nextProps.duration &&
    prevProps.compact === nextProps.compact &&
    prevProps.fullContent === nextProps.fullContent
  );
});

