import React from 'react';
import { Card, Space, Tag, Typography, Progress, Descriptions, Alert } from 'antd';
import { 
  CheckCircleOutlined, 
  InfoCircleOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  FileTextOutlined,
  GlobalOutlined
} from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;

interface IntentRecognitionCardProps {
  result: {
    intent: string;
    confidence: number;
    explanation: string;
    entities?: Record<string, any>;
    needsMultiAgent?: boolean;
  };
}

// 意图类型映射
const INTENT_TYPE_MAP: Record<string, { label: string; icon: any; color: string; description: string }> = {
  'complex_workflow': {
    label: '复杂工作流',
    icon: <ThunderboltOutlined />,
    color: 'purple',
    description: '需要多步骤执行的复杂任务'
  },
  'simple_query': {
    label: '简单查询',
    icon: <InfoCircleOutlined />,
    color: 'blue',
    description: '单次查询即可回答的问题'
  },
  'data_analysis': {
    label: '数据分析',
    icon: <FileTextOutlined />,
    color: 'orange',
    description: '需要分析和处理数据'
  },
  'information_gathering': {
    label: '信息收集',
    icon: <GlobalOutlined />,
    color: 'green',
    description: '从多个来源收集信息'
  },
  'report_generation': {
    label: '报告生成',
    icon: <FileTextOutlined />,
    color: 'cyan',
    description: '生成结构化报告'
  }
};

// 实体类型映射
const ENTITY_TYPE_MAP: Record<string, { label: string; icon?: string }> = {
  'target_person': { label: '目标人物', icon: '👤' },
  'data_source': { label: '数据源', icon: '📊' },
  'action': { label: '操作类型', icon: '⚡' },
  'output_format': { label: '输出格式', icon: '📄' },
  'task_type': { label: '任务类型', icon: '🎯' },
  'location': { label: '地点', icon: '📍' },
  'time': { label: '时间', icon: '⏰' },
  'keyword': { label: '关键词', icon: '🔑' }
};

export const IntentRecognitionCard: React.FC<IntentRecognitionCardProps> = ({ result }) => {
  const { intent, confidence, explanation, entities, needsMultiAgent } = result;
  
  // 获取意图类型信息
  const intentInfo = INTENT_TYPE_MAP[intent] || {
    label: intent,
    icon: <InfoCircleOutlined />,
    color: 'default',
    description: '未知意图类型'
  };

  // 置信度颜色
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'success';
    if (conf >= 0.7) return 'warning';
    return 'exception';
  };

  // 置信度文本
  const getConfidenceText = (conf: number) => {
    if (conf >= 0.9) return '高置信度';
    if (conf >= 0.7) return '中等置信度';
    return '低置信度';
  };

  return (
    <>
      <style>
        {`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .intent-card-animate {
            animation: slideInUp 0.3s ease-out;
          }
        `}
      </style>
      <Card
        size="small"
        className="intent-card-animate"
        style={{
          marginTop: 12,
          marginLeft: 20,
          border: `2px solid ${intentInfo.color === 'purple' ? '#722ed1' : '#1890ff'}`,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          background: 'linear-gradient(to bottom, #ffffff, #fafafa)'
        }}
      >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {/* 标题行 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span style={{ fontSize: 16 }}>{intentInfo.icon}</span>
            <Text strong style={{ fontSize: 14 }}>意图识别完成</Text>
            <Tag color={intentInfo.color} icon={<CheckCircleOutlined />}>
              {intentInfo.label}
            </Tag>
          </Space>
          
          {needsMultiAgent && (
            <Tag color="orange" icon={<TeamOutlined />}>
              多智能体协作
            </Tag>
          )}
        </div>

        {/* 意图说明 */}
        <Alert
          message={intentInfo.description}
          type="info"
          showIcon
          style={{ fontSize: 12 }}
        />

        {/* 置信度 */}
        <div>
          <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              识别置信度
            </Text>
            <Space size={4}>
              <Text strong style={{ fontSize: 13 }}>
                {(confidence * 100).toFixed(1)}%
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({getConfidenceText(confidence)})
              </Text>
            </Space>
          </Space>
          <Progress 
            percent={Math.round(confidence * 100)} 
            status={getConfidenceColor(confidence)}
            strokeColor={{
              '0%': confidence >= 0.9 ? '#52c41a' : confidence >= 0.7 ? '#faad14' : '#ff4d4f',
              '100%': confidence >= 0.9 ? '#73d13d' : confidence >= 0.7 ? '#ffc53d' : '#ff7875',
            }}
            size="small"
          />
        </div>

        {/* 解释说明 */}
        {explanation && (
          <div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
              📝 任务分析
            </Text>
            <Paragraph
              style={{
                fontSize: 12,
                marginTop: 8,
                marginBottom: 0,
                padding: 10,
                background: '#f0f5ff',
                borderLeft: '3px solid #1890ff',
                borderRadius: 4,
                lineHeight: 1.6
              }}
            >
              {explanation}
            </Paragraph>
          </div>
        )}

        {/* 识别的实体 */}
        {entities && Object.keys(entities).length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
              🎯 识别的关键信息
            </Text>
            <div style={{ marginTop: 8 }}>
              <Descriptions 
                size="small" 
                column={1}
                bordered
                labelStyle={{ 
                  fontSize: 11, 
                  padding: '6px 12px',
                  background: '#fafafa',
                  width: 100
                }}
                contentStyle={{ 
                  fontSize: 12, 
                  padding: '6px 12px' 
                }}
              >
                {Object.entries(entities).map(([key, value]) => {
                  const entityInfo = ENTITY_TYPE_MAP[key] || { label: key };
                  return (
                    <Descriptions.Item 
                      key={key}
                      label={
                        <Space size={4}>
                          {entityInfo.icon && <span>{entityInfo.icon}</span>}
                          <span>{entityInfo.label}</span>
                        </Space>
                      }
                    >
                      {typeof value === 'object' ? (
                        <pre style={{ 
                          margin: 0, 
                          fontSize: 11, 
                          fontFamily: 'monospace',
                          background: '#f5f5f5',
                          padding: 4,
                          borderRadius: 2
                        }}>
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : (
                        <Text strong>{String(value)}</Text>
                      )}
                    </Descriptions.Item>
                  );
                })}
              </Descriptions>
            </div>
          </div>
        )}

        {/* 执行提示 */}
        {needsMultiAgent && (
          <Alert
            message="系统将自动编排多个智能体协作完成此任务"
            type="success"
            showIcon
            icon={<TeamOutlined />}
            style={{ fontSize: 11 }}
          />
        )}
      </Space>
    </Card>
    </>
  );
};

