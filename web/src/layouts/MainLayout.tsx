import React, { useState } from 'react';
import { Layout, Menu, Typography, Space } from 'antd';
import {
  MessageOutlined,
  HistoryOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { ThemeToggle } from '../components/common/ThemeToggle';

const { Sider, Content } = Layout;
const { Title } = Typography;

type PageType = 'chat' | 'history' | 'logs';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  currentPage,
  onPageChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: 'chat',
      icon: <MessageOutlined />,
      label: '对话',
    },
    {
      key: 'history',
      icon: <HistoryOutlined />,
      label: '历史记录',
    },
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={200}
        style={{
          background: 'var(--ant-color-bg-container)',
          borderRight: '1px solid var(--ant-color-border)',
        }}
      >
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid var(--ant-color-border)',
          }}
        >
          {!collapsed ? (
            <Space>
              <RobotOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
              <Title level={4} style={{ margin: 0 }}>
                Monkey Agent
              </Title>
            </Space>
          ) : (
            <RobotOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={({ key }) => onPageChange(key as PageType)}
          style={{ borderRight: 0 }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            padding: '16px',
            borderTop: '1px solid var(--ant-color-border)',
            background: 'var(--ant-color-bg-container)'
          }}
        >
          <ThemeToggle />
        </div>
      </Sider>

      <Content
        style={{
          padding: 0,
          overflow: 'hidden',
          background: 'var(--ant-color-bg-layout)',
        }}
      >
        {children}
      </Content>
    </Layout>
  );
};

