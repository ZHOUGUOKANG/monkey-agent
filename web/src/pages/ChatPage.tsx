import React, { useEffect } from 'react';
import { message as antdMessage, Typography } from 'antd';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { EventLogPanel } from '../components/chat/EventLogPanel';
import { useChatStore } from '../stores/chatStore';
import { useConnectionStore } from '../stores/connectionStore';
import { wsClient } from '../services/websocket';
import { logger } from '../services/logger';
import type { Message, ExecutionEvent, Artifact } from '../types';

export const ChatPage: React.FC = () => {
  const { 
    messages, 
    isProcessing, 
    addMessage, 
    appendToLastMessage,
    updateMessage,
    setProcessing, 
    setWorkflow,
    startWorkflowExecution,
    addExecutionEvent,
    completeWorkflowExecution,
    addChatEvent, // 新增
  } = useChatStore();
  const connectionStatus = useConnectionStore((state) => state.status);

  useEffect(() => {
    // 监听 WebSocket 消息
    const handleStream = (data: any) => {
      console.log('Stream data:', data);
      
      // 记录事件
      addChatEvent({
        type: 'stream',
        source: 'ai',
        data: data.payload,
        message: `流式数据: ${data.payload?.type || 'unknown'}`
      });
      
      if (data.payload?.type === 'text') {
        const chunk = data.payload.content;
        
        // 检查最后一条消息是否是 AI 消息
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && lastMessage.role === 'ai') {
          // 如果最后一条是 AI 消息，追加内容
          appendToLastMessage(chunk);
        } else {
          // 否则创建新的 AI 消息
          const aiMessage: Message = {
            id: data.id || `ai-${Date.now()}`,
            role: 'ai',
            content: chunk,
            timestamp: Date.now(),
          };
          addMessage(aiMessage);
        }
      } else if (data.payload?.type === 'code' || data.payload?.type === 'html') {
        // 新增：处理流式代码（React 或 HTML）
        const chunk = data.payload.content;
        const artifactId = data.payload.artifactId || 'streaming-artifact';
        const codeType = data.payload.type === 'html' ? 'html' : 'react';
        
        // 累积代码到临时 artifact
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.artifact && lastMessage.artifact.id === artifactId) {
          // 更新现有 artifact
          const artifact = lastMessage.artifact;
          const updatedArtifact: Artifact = {
            id: artifact.id,
            title: artifact.title,
            type: codeType as 'react' | 'html',
            code: artifact.code + chunk,
            createdAt: artifact.createdAt,
          };
          
          updateMessage(lastMessage.id, {
            artifact: updatedArtifact,
            content: codeType === 'html' ? '正在生成 HTML 报告...' : lastMessage.content,
          });
        } else {
          // 创建新的 artifact 消息
          addMessage({
            id: `ai-${Date.now()}`,
            role: 'ai',
            content: codeType === 'html' ? '正在生成 HTML 报告...' : '正在生成报告...',
            artifact: {
              id: artifactId,
              type: codeType as 'react' | 'html',
              title: '数据报告',
              code: chunk,
              createdAt: Date.now(),
            },
            timestamp: Date.now(),
          });
        }
      } else if (data.payload?.type === 'status') {
        // 状态消息 - 显示在聊天中
        const content = data.payload.content;
        const loading = data.payload.loading;
        const toolName = data.payload.toolName;
        
        logger.info(content, data.payload.source || 'Agent');
        
        // 将状态消息添加到聊天历史
        const statusId = `status-${toolName || Date.now()}`;
        
        // 如果是 loading 状态，添加新的状态消息
        if (loading) {
          addMessage({
            id: statusId,
            role: 'system',
            content,
            timestamp: Date.now(),
            isLoading: true,
            toolName: toolName
          });
        } else {
          // 如果是完成状态，更新对应的状态消息
          const statusMessageIndex = messages.findIndex(m => m.toolName === toolName && m.isLoading);
          if (statusMessageIndex !== -1) {
            const statusMessage = messages[statusMessageIndex];
            updateMessage(statusMessage.id, {
              content,
              isLoading: false
            });
          } else {
            // 如果找不到对应的 loading 消息，直接添加
            addMessage({
              id: statusId,
              role: 'system',
              content,
              timestamp: Date.now(),
            });
          }
        }
      }
    };

    const handleAgentEvent = (data: any) => {
      console.log('✅ Agent event received:', data);
      console.log('Event type:', data.event?.type);
      const event = data.event;
      
      if (!event) {
        console.error('❌ No event data!');
        return;
      }
      
      // 记录所有 agent 事件
      addChatEvent({
        type: event.type,
        source: 'agent',
        data: event,
        message: `Agent 事件: ${event.type}`
      });
      
      // 普通 chat 不需要显示这些技术细节，只记录日志
      // 所有细节信息都在 WorkflowExecutionStatus 中展示
      logger.debug(`Agent 事件: ${event.type}`, 'Agent');
    };

    const handleResponse = (data: any) => {
      console.log('Response data:', data);
      
      // 记录响应事件
      addChatEvent({
        type: 'response',
        source: 'system',
        data: data.payload,
        message: `收到响应: ${data.payload?.type || 'unknown'}`
      });
      
      if (data.payload?.type === 'workflow') {
        // 收到 workflow
        let workflow = data.payload.workflow;
        
        // 如果 agentGraph 是字符串，解析为数组
        if (typeof workflow.agentGraph === 'string') {
          try {
            // 修复策略：处理字符串值内部的中文引号
            let jsonStr = workflow.agentGraph;
            
            // 先把中文引号替换为临时标记
            jsonStr = jsonStr.replace(/"/g, '<<<LEFT_QUOTE>>>').replace(/"/g, '<<<RIGHT_QUOTE>>>');
            
            // 然后把临时标记替换为转义的英文引号（在 JSON 字符串值内部需要转义）
            jsonStr = jsonStr.replace(/<<<LEFT_QUOTE>>>/g, '\\"').replace(/<<<RIGHT_QUOTE>>>/g, '\\"');
            
            workflow = {
              ...workflow,
              agentGraph: JSON.parse(jsonStr)
            };
            console.log('✅ Successfully parsed agentGraph from string to array');
          } catch (error) {
            console.error('❌ Failed to parse agentGraph:', error);
            
            // 尝试显示更多调试信息
            console.error('agentGraph string:', workflow.agentGraph.substring(0, 500));
            
            logger.error(`无法解析工作流图: ${error}`, 'Workflow');
            
            // 显示友好的错误提示
            antdMessage.error('工作流解析失败，请重试或联系管理员');
            
            // 设置为空数组，避免后续崩溃
            workflow = {
              ...workflow,
              agentGraph: []
            };
          }
        }
        
        // 调试日志：检查 workflow 结构
        console.log('Received workflow:', {
          workflow,
          agentGraphType: typeof workflow.agentGraph,
          agentGraph: workflow.agentGraph,
          isArray: Array.isArray(workflow.agentGraph)
        });
        
        logger.info(`✅ 已生成工作流: ${workflow.name}`, 'Workflow');
        
        const aiMessage: Message = {
          id: data.id || `ai-${Date.now()}`,
          role: 'ai',
          content: `已生成工作流: ${workflow.name}`,
          timestamp: Date.now(),
          workflow,
        };
        addMessage(aiMessage);
        setWorkflow(workflow);
        setProcessing(false);
      } else if (data.payload?.type === 'artifact') {
        // 收到 artifact（报告）
        const artifact = data.payload.artifact;
        
        logger.info(`✅ 已生成报告: ${artifact.title}`, 'Artifact');
        
        const aiMessage: Message = {
          id: data.id || `ai-${Date.now()}`,
          role: 'ai',
          content: `已生成报告: ${artifact.title}`,
          timestamp: Date.now(),
          artifact,
        };
        addMessage(aiMessage);
        setProcessing(false);
      } else if (data.payload?.status) {
        // 工作流执行完成 - 添加总结消息
        completeWorkflowExecution(data.payload.status);
        logger.info(`工作流执行完成: ${data.payload.status}`, 'Workflow');
        
        const summaryMessage: Message = {
          id: `summary-${Date.now()}`,
          role: 'system',
          content: `🎉 工作流执行${data.payload.status === 'completed' ? '完成' : '失败'}`,
          timestamp: Date.now(),
          agentStatus: {
            phase: data.payload.status === 'completed' ? 'complete' : 'error',
            details: data.payload
          }
        };
        addMessage(summaryMessage);
        
        if (data.payload.status === 'completed') {
          antdMessage.success('工作流执行完成！');
        } else {
          antdMessage.error('工作流执行失败！');
        }
      } else if (data.payload?.done) {
        logger.info('对话完成', 'Chat');
        setProcessing(false);
      }
    };

    const handleWorkflowEvent = (data: any) => {
      console.log('Workflow event:', data);
      console.log('Event detail:', {
        eventType: data.event?.type,
        eventNodeId: data.event?.nodeId,
        eventAgentId: data.event?.agentId,
        fullEvent: data.event
      });
      
      const event = data.event;
      
      // 检查事件是否有效
      if (!event || !event.type) {
        console.error('❌ Invalid workflow event:', data);
        return;
      }
      
      // 记录 workflow 事件
      addChatEvent({
        type: event.type,
        source: 'workflow',
        data: event,
        message: `Workflow: ${event.type}`
      });
      
      // 使用 nodeId（workflow 节点 ID）而不是 agentId（实际 agent ID）
      const nodeId = event.nodeId || event.agentId;
      
      const executionEvent: ExecutionEvent = {
        type: event.type,
        nodeId: nodeId,
        agentId: event.agentId,
        timestamp: Date.now(),
        data: event,
      };
      
      console.log('📝 Adding execution event:', executionEvent);
      
      // 将事件添加到 workflowExecution 状态中（用于 WorkflowExecutionStatus 组件显示）
      addExecutionEvent(executionEvent);
      
      // 移除系统消息，所有细节在 WorkflowExecutionStatus 中显示
      // 只记录日志
      logger.debug(`Workflow 事件: ${event.type}`, 'Workflow');
      
      // 其他事件（thinking、tool-call、tool-result 等）只添加到 executionEvent，
      // 不作为独立消息显示，它们会在 WorkflowExecutionStatus 组件中嵌套展示
    };

    const handleError = (data: any) => {
      console.error('WebSocket error:', data);
      const errorMsg = data.payload?.error || '未知错误';
      
      // 记录错误事件
      addChatEvent({
        type: 'error',
        source: 'system',
        data: data.payload,
        message: `错误: ${errorMsg}`
      });
      
      logger.error(`发生错误: ${errorMsg}`, 'System');
      antdMessage.error('发生错误: ' + errorMsg);
      setProcessing(false);
      completeWorkflowExecution('failed');
    };

    const handleConnect = () => {
      logger.info('WebSocket 已连接', 'System');
      addChatEvent({
        type: 'connect',
        source: 'system',
        message: 'WebSocket 已连接'
      });
    };

    const handleDisconnect = () => {
      logger.warn('WebSocket 已断开', 'System');
      addChatEvent({
        type: 'disconnect',
        source: 'system',
        message: 'WebSocket 已断开'
      });
    };

    wsClient.on('connect', handleConnect);
    wsClient.on('disconnect', handleDisconnect);
    wsClient.on('stream', handleStream);
    wsClient.on('agent:event', handleAgentEvent);
    wsClient.on('response', handleResponse);
    wsClient.on('workflow:event', handleWorkflowEvent);
    wsClient.on('error', handleError);

    return () => {
      wsClient.off('connect', handleConnect);
      wsClient.off('disconnect', handleDisconnect);
      wsClient.off('stream', handleStream);
      wsClient.off('agent:event', handleAgentEvent);
      wsClient.off('response', handleResponse);
      wsClient.off('workflow:event', handleWorkflowEvent);
      wsClient.off('error', handleError);
    };
  }, [addMessage, appendToLastMessage, updateMessage, setProcessing, setWorkflow, addExecutionEvent, completeWorkflowExecution, startWorkflowExecution, messages, addChatEvent]);

  const handleSend = (content: string) => {
    // 记录用户消息事件
    addChatEvent({
      type: 'user-message',
      source: 'user',
      message: `用户发送消息: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
    });
    
    // 添加用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    addMessage(userMessage);
    setProcessing(true);

    // 记录到日志
    logger.info(`用户: ${content}`, 'User');

    // 发送到服务器
    wsClient.sendChat(content);
  };

  const handleRunWorkflow = (workflow: any) => {
    addChatEvent({
      type: 'workflow-start',
      source: 'workflow',
      data: workflow,
      message: `开始执行工作流: ${workflow.name}`
    });
    
    logger.info(`开始执行工作流: ${workflow.name}`, 'Workflow');
    antdMessage.info('开始执行工作流...');
    startWorkflowExecution(workflow.id);
    wsClient.executeWorkflow(workflow);
  };

  const handleCompileError = (artifactId: string, error: string) => {
    console.log('编译错误，请求 HTML 降级:', { artifactId, error });
    
    // 通过 WebSocket 通知后端
    wsClient.requestFallback(artifactId, error);
    
    // 显示友好提示
    antdMessage.warning('React 代码编译失败，正在生成 HTML 版本...');
    logger.warn(`React 编译失败，降级到 HTML: ${error}`, 'Report');
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%',
      position: 'relative'
    }}>
      {/* 中间聊天区 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        alignItems: 'center',
        justifyContent: messages.length === 0 ? 'center' : 'flex-start'
      }}>
        {messages.length === 0 ? (
          /* 空状态：输入框居中 */
          <div style={{ 
            width: '100%', 
            maxWidth: '800px', 
            padding: '0 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 48
          }}>
            {/* 欢迎标题 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 42, 
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: 16,
                letterSpacing: '-0.02em'
              }}>
                你好，我是 Monkey Agent
              </div>
              <Typography.Text type="secondary" style={{ 
                fontSize: 16,
                lineHeight: 1.6
              }}>
                一个智能工作流助手，可以帮你分解任务、协调多个 AI Agent 完成复杂工作
              </Typography.Text>
            </div>
            
            {/* 示例问题卡片 */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 24
            }}>
              {[
                { icon: '🔍', text: '帮我分析一下市场趋势' },
                { icon: '📊', text: '生成一份数据报告' },
                { icon: '🤖', text: '创建一个自动化工作流' },
                { icon: '💡', text: '给我一些创意建议' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => !isProcessing && connectionStatus === 'connected' && handleSend(item.text)}
                  style={{
                    padding: '16px 20px',
                    background: 'var(--ant-color-bg-container)',
                    border: '1px solid var(--ant-color-border)',
                    borderRadius: 16,
                    cursor: isProcessing || connectionStatus !== 'connected' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: isProcessing || connectionStatus !== 'connected' ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (isProcessing || connectionStatus !== 'connected') return;
                    e.currentTarget.style.borderColor = '#1890ff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--ant-color-border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ 
                    fontSize: 14, 
                    color: 'var(--ant-color-text)',
                    fontWeight: 500
                  }}>
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
            
            {/* 输入框 */}
            <ChatInput
              onSend={handleSend}
              disabled={isProcessing || connectionStatus !== 'connected'}
            />
          </div>
        ) : (
          /* 有消息：正常布局 */
          <>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto',
              paddingBottom: '16px',
              width: '100%'
            }}>
              <MessageList 
                messages={messages} 
                onRunWorkflow={handleRunWorkflow}
                onCompileError={handleCompileError}
              />
            </div>
            
            {/* 输入框固定在底部 */}
            <div style={{
              position: 'sticky',
              bottom: 0,
              width: '100%',
              background: 'linear-gradient(to top, var(--ant-color-bg-container) 80%, transparent)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'center',
              padding: '24px 32px 20px'
            }}>
              <div style={{ width: '100%', maxWidth: '800px' }}>
                <ChatInput
                  onSend={handleSend}
                  disabled={isProcessing || connectionStatus !== 'connected'}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 右侧事件日志面板 */}
      <div style={{
        width: '350px',
        borderLeft: '1px solid var(--ant-color-border)',
        background: 'var(--ant-color-bg-layout)',
        overflow: 'hidden'
      }}>
        <EventLogPanel />
      </div>
    </div>
  );
};

