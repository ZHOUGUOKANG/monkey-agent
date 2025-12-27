import React, { useEffect, useRef } from 'react';
import { Button, Space, Typography, Tag, Empty } from 'antd';
import { PauseOutlined, PlayCircleOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLogStore } from '../stores/logStore';
import { logger } from '../services/logger';
import type { LogEntry } from '../types';

const { Title, Text } = Typography;

const LogLevelTag: React.FC<{ level: LogEntry['level'] }> = ({ level }) => {
  const colors: Record<LogEntry['level'], string> = {
    debug: 'default',
    info: 'blue',
    warn: 'orange',
    error: 'red',
  };

  return (
    <Tag color={colors[level]} style={{ minWidth: 60, textAlign: 'center' }}>
      {level.toUpperCase()}
    </Tag>
  );
};

export const LogsPage: React.FC = () => {
  const { logs, isPaused, setLogs, clearLogs, setPaused } = useLogStore();
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 订阅日志
    const unsubscribe = logger.subscribe((newLogs) => {
      if (!isPaused) {
        setLogs(newLogs);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isPaused, setLogs]);

  useEffect(() => {
    if (!isPaused) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

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
          实时日志
        </Title>
        <Space>
          <Button
            icon={isPaused ? <PlayCircleOutlined /> : <PauseOutlined />}
            onClick={() => setPaused(!isPaused)}
          >
            {isPaused ? '继续' : '暂停'}
          </Button>
          <Button icon={<ClearOutlined />} onClick={clearLogs}>
            清空
          </Button>
        </Space>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px',
          background: 'var(--ant-color-bg-layout)',
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        {logs.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Empty description="暂无日志" />
          </div>
        ) : (
          <>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  marginBottom: 12,
                  padding: 12,
                  background: 'var(--ant-color-bg-container)',
                  borderRadius: 4,
                  border: '1px solid var(--ant-color-border)',
                }}
              >
                <Space style={{ marginBottom: 8 }}>
                  <LogLevelTag level={log.level} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(log.timestamp).format('HH:mm:ss.SSS')}
                  </Text>
                  {log.source && (
                    <Tag color="purple" style={{ fontSize: 11 }}>
                      {log.source}
                    </Tag>
                  )}
                </Space>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {log.message}
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>
    </div>
  );
};

