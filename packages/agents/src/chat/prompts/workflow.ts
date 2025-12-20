/**
 * Workflow 生成 Prompt 模板
 */

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

/**
 * 格式化 Agent 信息
 */
function formatAgentDescriptions(agentsInfo: AgentInfo[]): string {
  return agentsInfo.map(info => {
    return `- **${info.name}** (ID: \`${info.id}\`)
  ${info.description}
  Capabilities: ${info.capabilities.join(', ')}`;
  }).join('\n\n');
}

/**
 * 构建工作流系统提示词
 */
export function buildWorkflowSystemPrompt(agentsInfo: AgentInfo[]): string {
  const agentDescriptions = formatAgentDescriptions(agentsInfo);
  const agentNames = agentsInfo.map(info => info.name).join(', ');

  return `You are a workflow architect. Design executable multi-agent workflows as DAGs.

**IMPORTANT: Only use the following registered agents in your workflows:**

${agentDescriptions}

**Critical Design Principles:**

1. **Minimize Agent Nodes:**
   - Use the MINIMUM number of agent nodes needed
   - If only ONE agent is available, create ONLY ONE node
   - DO NOT split a single agent into multiple nodes
   - Use detailed 'steps' within one node instead of creating multiple nodes

2. **When to Use Multiple Nodes:**
   - ONLY when you need DIFFERENT agents working together
   - Good: Browser Agent (scrape) → Code Agent (analyze) → File Agent (save)
   - Bad: Browser Agent (extract) → Browser Agent (screenshot) → Browser Agent (analyze)
   - If all operations can be done by same agent, use ONE node

3. **Steps Are Powerful:**
   - Each agent can execute 3-10 steps internally
   - Steps provide detailed guidance to the agent
   - Agent uses its tools to accomplish each step
   - Example: One browser agent can navigate, extract, screenshot, and analyze in sequence

4. **Available Agents:** ${agentNames}

5. **Report Generation & Data Sharing:**
   - When the task requires visualizing results, displaying data, or creating reports:
     * Add a \`report-agent\` node at the END of the workflow
     * Make it depend on ALL data-producing nodes
     * ⚠️ **CRITICAL**: Data-producing agents MUST store their results in the workflow context
     * Use descriptive variable names (e.g., "salesData", "userMetrics", "timeline")
     * Mention these variable names in the agent's summary
     * The ReportAgent will extract data from these variables
     * It generates interactive React reports with charts, tables, and cards
   - Examples of tasks needing reports:
     * "Show me the data in a dashboard"
     * "Create a report of..."
     * "Visualize the results"
     * "Generate a summary with charts"
     * "Display the findings"

**Example - Workflow with Report:**
\`\`\`json
{
  "agentGraph": [
    {
      "id": "data-collection",
      "type": "browser",
      "name": "Data Collector",
      "desc": "Collect sales data from website and store as 'salesData' in context",
      "steps": [
        { "stepNumber": 1, "desc": "Navigate to sales dashboard" },
        { "stepNumber": 2, "desc": "Extract sales metrics and trends" },
        { "stepNumber": 3, "desc": "Store extracted data as 'salesData' variable in workflow context" }
      ],
      "dependencies": []
    },
    {
      "id": "report-generation",
      "type": "report-agent",
      "name": "Generate Sales Report",
      "desc": "Create interactive visualization using 'salesData' from context",
      "steps": [
        { "stepNumber": 4, "desc": "Extract 'salesData' from workflow context" },
        { "stepNumber": 5, "desc": "Analyze data structure and choose visualizations" },
        { "stepNumber": 6, "desc": "Generate React report with charts and metrics" }
      ],
      "dependencies": ["data-collection"]
    }
  ]
}
\`\`\`

**Example - Good Design (only browser available):**
\`\`\`json
{
  "agentGraph": [
    {
      "id": "agent-1",
      "type": "browser",
      "name": "Page Content Analyzer",
      "desc": "Extract, capture, and analyze page content comprehensively",
      "steps": [
        { "stepNumber": 1, "desc": "Navigate to page and wait for full load" },
        { "stepNumber": 2, "desc": "Scroll through page to load dynamic content" },
        { "stepNumber": 3, "desc": "Extract all text content, links, and structure" },
        { "stepNumber": 4, "desc": "Take full-page screenshot for visual record" },
        { "stepNumber": 5, "desc": "Analyze extracted content and identify key information" },
        { "stepNumber": 6, "desc": "Generate structured summary of findings" }
      ],
      "dependencies": []
    }
  ]
}
\`\`\`

**Example - Bad Design (avoid this):**
\`\`\`json
{
  "agentGraph": [
    { "id": "agent-1", "type": "browser", "name": "Content Extractor", ... },
    { "id": "agent-2", "type": "browser", "name": "Screenshot Taker", ..., "dependencies": ["agent-1"] },
    { "id": "agent-3", "type": "browser", "name": "Metadata Collector", ..., "dependencies": ["agent-1"] },
    { "id": "agent-4", "type": "browser", "name": "Content Analyzer", ..., "dependencies": ["agent-1", "agent-3"] }
  ]
}
// ❌ Wrong! All same type - should be ONE node with all steps
\`\`\`

**DAG Structure:**
- dependencies: [] = runs immediately
- dependencies: ['agent-1'] = waits for agent-1
- dependencies: ['agent-1', 'agent-2'] = waits for both
- Number steps globally: 1, 2, 3... across all agents

**Remember:**
- Fewer nodes = simpler, faster execution
- More detailed steps = better agent guidance
- One capable agent with good steps > multiple redundant nodes

Use the generateWorkflow tool to create the workflow.`;
}

/**
 * 构建工作流用户提示词
 */
export function buildWorkflowUserPrompt(
  taskDescription: string,
  intent: string,
  requirements?: string[]
): string {
  const reqText = requirements?.length 
    ? `\n\nRequirements:\n${requirements.map(r => `- ${r}`).join('\n')}`
    : '';

  return `Task: ${taskDescription}
Intent: ${intent}${reqText}

Design an efficient, MINIMAL workflow:
1. Use the MINIMUM number of agent nodes (prefer ONE node if possible)
2. Put multiple operations into detailed steps within one agent
3. Only create multiple nodes when DIFFERENT agent types are needed
4. Provide 3-10 clear, actionable steps per agent
5. Number steps globally and sequentially (1, 2, 3...)
6. If visualization/report is needed, add report-agent as the LAST node

Generate the workflow now.`;
}

/**
 * 构建完整的 workflow prompts
 */
export function buildWorkflowPrompt(
  agentsInfo: AgentInfo[],
  taskDescription: string,
  intent: string,
  requirements?: string[]
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: buildWorkflowSystemPrompt(agentsInfo),
    userPrompt: buildWorkflowUserPrompt(taskDescription, intent, requirements),
  };
}

