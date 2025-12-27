import React, { useEffect, useRef } from 'react';
import { Empty } from 'antd';
import { MessageBubble } from './MessageBubble';
import { WorkflowCard } from './WorkflowCard';
import { WorkflowExecutionStatus } from './WorkflowExecutionStatus';
import { useChatStore } from '../../stores/chatStore';
import type { Message, Workflow } from '../../types';

interface MessageListProps {
  messages: Message[];
  onRunWorkflow?: (workflow: Workflow) => void;
  onCompileError?: (artifactId: string, error: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, onRunWorkflow, onCompileError }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const workflowExecution = useChatStore((state) => state.workflowExecution);
  const currentWorkflow = useChatStore((state) => state.currentWorkflow);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, workflowExecution]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <Empty description="开始新的对话吧！" />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '24px',
        paddingBottom: '80px', // 为底部输入框留出空间
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '900px' }}>
        {messages.map((message, index) => (
          <div key={`${message.id}-${index}`}>
            <MessageBubble message={message} onCompileError={onCompileError} />
            {message.workflow && <WorkflowCard workflow={message.workflow} onRun={onRunWorkflow} />}
          </div>
        ))}
        
        {/* 显示工作流执行状态 */}
        {workflowExecution && currentWorkflow && (
          <WorkflowExecutionStatus
            workflow={currentWorkflow}
            status={workflowExecution.status}
            currentAgent={workflowExecution.currentAgent}
            events={workflowExecution.events}
            completedAgents={workflowExecution.completedAgents}
            failedAgents={workflowExecution.failedAgents}
            startTime={workflowExecution.startTime}
            iterations={workflowExecution.iterations}
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

