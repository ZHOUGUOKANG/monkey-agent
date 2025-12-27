import React, { useEffect } from 'react';
import { List, Button, Empty, Typography, Space, Modal, message as antdMessage } from 'antd';
import { DeleteOutlined, MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useHistoryStore } from '../stores/historyStore';
import { useChatStore } from '../stores/chatStore';
import type { Conversation } from '../types';

const { Title, Text } = Typography;

export const HistoryPage: React.FC = () => {
  const { conversations, loadHistory, deleteConversation, clearAll } = useHistoryStore();
  const { addMessage, clearMessages } = useChatStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleLoadConversation = (conversation: Conversation) => {
    clearMessages();
    conversation.messages.forEach((msg) => addMessage(msg));
    antdMessage.success('已加载历史对话');
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条对话记录吗？',
      onOk: () => {
        deleteConversation(id);
        antdMessage.success('已删除');
      },
    });
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: '确认清空',
      content: '确定要清空所有历史记录吗？此操作不可撤销！',
      okType: 'danger',
      onOk: () => {
        clearAll();
        antdMessage.success('已清空');
      },
    });
  };

  // 按日期分组
  const groupedConversations = conversations.reduce((groups, conv) => {
    const date = dayjs(conv.timestamp).format('YYYY-MM-DD');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(conv);
    return groups;
  }, {} as Record<string, Conversation[]>);

  const getDateLabel = (dateStr: string) => {
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

    if (dateStr === today) return '今天';
    if (dateStr === yesterday) return '昨天';
    return dateStr;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--ant-color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          历史记录
        </Title>
        {conversations.length > 0 && (
          <Button danger onClick={handleClearAll}>
            清空全部
          </Button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {conversations.length === 0 ? (
          <Empty description="暂无历史记录" />
        ) : (
          Object.entries(groupedConversations).map(([date, convs]) => (
            <div key={date} style={{ marginBottom: 24 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                {getDateLabel(date)}
              </Text>
              <List
                dataSource={convs}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        icon={<MessageOutlined />}
                        onClick={() => handleLoadConversation(item)}
                      >
                        加载
                      </Button>,
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(item.id)}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      title={item.title}
                      description={
                        <Space>
                          <Text type="secondary">
                            {dayjs(item.timestamp).format('HH:mm:ss')}
                          </Text>
                          <Text type="secondary">·</Text>
                          <Text type="secondary">{item.messages.length} 条消息</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

