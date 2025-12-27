import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import type { Workflow } from '../../types';

interface WorkflowDiagramProps {
  workflow: Workflow;
  currentAgent?: string;
  completedAgents: string[];
  failedAgents: string[];
}

export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  workflow,
  currentAgent,
  completedAgents,
  failedAgents,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mermaidId = useRef(`mermaid-${Date.now()}`);

  useEffect(() => {
    // 初始化 Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
      },
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // 生成 Mermaid 语法
    const generateMermaidGraph = () => {
      let graph = 'graph LR\n';
      
      // 添加节点
      workflow.agentGraph.forEach((node) => {
        // 使用节点 ID 作为节点名（不使用空格）
        const nodeId = node.id.replace(/-/g, '_');
        const nodeLabel = `${node.name}`;
        const nodeType = node.type;
        
        // 根据状态设置样式类
        let styleClass = 'pending';
        if (failedAgents.includes(node.id)) {
          styleClass = 'failed';
        } else if (completedAgents.includes(node.id)) {
          styleClass = 'completed';
        } else if (currentAgent === node.id) {
          styleClass = 'running';
        }
        
        // 添加节点定义（使用方括号避免语法错误）
        graph += `  ${nodeId}["${nodeLabel}<br/><small>${nodeType}</small>"]:::${styleClass}\n`;
      });
      
      // 添加边（dependencies）
      workflow.agentGraph.forEach((node) => {
        const nodeId = node.id.replace(/-/g, '_');
        node.dependencies.forEach((dep) => {
          const depId = dep.replace(/-/g, '_');
          graph += `  ${depId} --> ${nodeId}\n`;
        });
      });
      
      // 添加样式定义
      graph += '\n';
      graph += '  classDef pending fill:#e8e8e8,stroke:#999,stroke-width:2px\n';
      graph += '  classDef running fill:#e6f7ff,stroke:#1890ff,stroke-width:3px\n';
      graph += '  classDef completed fill:#f6ffed,stroke:#52c41a,stroke-width:2px\n';
      graph += '  classDef failed fill:#fff1f0,stroke:#ff4d4f,stroke-width:2px\n';
      
      return graph;
    };

    const mermaidCode = generateMermaidGraph();
    
    // 渲染 Mermaid 图表
    const renderDiagram = async () => {
      try {
        // 清空容器
        containerRef.current!.innerHTML = '';
        
        // 渲染新图表
        const { svg } = await mermaid.render(mermaidId.current, mermaidCode);
        containerRef.current!.innerHTML = svg;
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        containerRef.current!.innerHTML = '<p style="color: red;">流程图渲染失败</p>';
      }
    };

    renderDiagram();
  }, [workflow, currentAgent, completedAgents, failedAgents]);

  return (
    <div 
      ref={containerRef} 
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px',
        background: 'var(--ant-color-bg-layout)',
        borderRadius: '4px',
        minHeight: '120px',
      }}
    />
  );
};

