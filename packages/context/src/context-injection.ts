import type { AgentNodeStep, ParentNodeInfo } from './types';

/**
 * 构建完整的上下文注入 prompt
 * 
 * 注意：不在 prompt 中注入父节点的 output 数据
 * Agent 应该通过 valGet 工具从 sharedContext.vals 中获取数据
 * 父节点的 summary 会告知数据保存在哪个 key
 */
export function buildContextInjectionPrompt(params: {
  workflowTask: string;
  currentTask: string;
  steps: AgentNodeStep[];
  parentNodes: ParentNodeInfo[];
  sharedVars: Map<string, any>;
}): string {
  const { workflowTask, currentTask, steps, parentNodes, sharedVars } = params;

  let prompt = `# Workflow Context

## Overall Workflow Task
${workflowTask}

## Your Current Task
${currentTask}

## Execution Steps
${steps.map(s => `${s.stepNumber}. ${s.desc}`).join('\n')}
`;

  // 添加父节点信息（只包含 summary，不包含 output）
  if (parentNodes.length > 0) {
    prompt += `\n## Parent Nodes (Dependencies)
You depend on the following agents. Their summaries tell you where to find the data:

`;
    parentNodes.forEach((parent, index) => {
      prompt += `### ${index + 1}. ${parent.agentId}
**Task**: ${parent.task}

**Summary**: ${parent.summary}

`;
    });
    
    prompt += `**Important**: The parent summaries tell you which shared variables contain the data you need.
Use the 'valGet' tool to retrieve data from shared variables mentioned in the summaries.

`;
  }

  // 添加共享变量信息
  if (sharedVars.size > 0) {
    prompt += `\n## Available Shared Variables
The following variables are currently available:

`;
    const varKeys = Array.from(sharedVars.keys());
    varKeys.forEach(key => {
      prompt += `- **${key}**\n`;
    });

    prompt += `\nYou can:
- Read these variables using 'valGet({ key: "variableName" })'
- Set new variables using 'valSet({ key: "variableName", value: ... })'
- List all variables using 'valList({})'
`;
  } else {
    prompt += `\n## Shared Variables
No shared variables are currently available. You can create variables using the 'valSet' tool to share data with downstream agents.
`;
  }

  return prompt;
}

