import React from 'react';
import { Card, Button, Collapse, Steps, Space, Typography, Tag } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { Workflow } from '../../types';

const { Paragraph } = Typography;

interface WorkflowCardProps {
  workflow: Workflow;
  onRun?: (workflow: Workflow) => void;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({ workflow, onRun }) => {
  // 安全检查：确保 agentGraph 是数组
  let agentGraph: any[] = [];
  
  if (Array.isArray(workflow.agentGraph)) {
    agentGraph = workflow.agentGraph;
  } else if (typeof workflow.agentGraph === 'string') {
    // 如果是字符串，尝试解析
    try {
      agentGraph = JSON.parse(workflow.agentGraph);
      console.log('✅ WorkflowCard: Parsed agentGraph from string');
    } catch (error) {
      console.error('❌ WorkflowCard: Failed to parse agentGraph:', error);
      agentGraph = [];
    }
  } else {
    console.error('❌ WorkflowCard: agentGraph is neither array nor string', {
      workflow,
      agentGraphType: typeof workflow.agentGraph,
      agentGraph: workflow.agentGraph
    });
  }

  return (
    <Card
      title={
        <Space>
          <PlayCircleOutlined />
          {workflow.name}
        </Space>
      }
      extra={
        onRun && (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => onRun(workflow)}
          >
            运行
          </Button>
        )
      }
      style={{ marginTop: 16, marginBottom: 16 }}
    >
      <Paragraph type="secondary">{workflow.description}</Paragraph>

      {workflow.estimatedDuration && (
        <Tag color="blue" style={{ marginBottom: 16 }}>
          预计用时: {Math.round(workflow.estimatedDuration / 1000)}秒
        </Tag>
      )}

      {agentGraph.length === 0 ? (
        <Paragraph type="warning">暂无执行步骤</Paragraph>
      ) : (
        <Collapse
          items={agentGraph.map((node) => ({
            key: node.id,
            label: `${node.name} (${node.type})`,
            children: (
              <>
                <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                  {node.desc}
                </Paragraph>
                <Steps
                  size="small"
                  orientation="vertical"
                  items={node.steps.map((step: any) => ({
                    title: `步骤 ${step.stepNumber}`,
                    content: step.desc,
                  }))}
                />
                {node.dependencies.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Tag>依赖: {node.dependencies.join(', ')}</Tag>
                  </div>
                )}
              </>
            )
          }))}
        />
      )}
    </Card>
  );
};

