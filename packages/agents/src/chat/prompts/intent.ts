/**
 * 意图识别 Prompt 模板
 */

/**
 * 构建意图识别提示词
 */
export function buildIntentPrompt(
  userMessage: string,
  context?: Record<string, any>
): string {
  return `Analyze the following user message and identify the intent.

User Message: "${userMessage}"

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Please classify the intent into one of these categories:
1. **simple_chat**: Casual conversation, greetings, general questions (no actions needed)
2. **complex_workflow**: Any task that requires execution (single or multiple agents)
3. **information_query**: Query for information or data
4. **uncertain**: Intent is unclear

Consider these factors:
- Does the request require executing actions or operations?
- Are different capabilities/tools required?
- Is there a need for data flow between different components?
- Does it involve dependencies between tasks?

Respond with a JSON object:
{
  "intent": "simple_chat | complex_workflow | information_query | uncertain",
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of why this intent was chosen",
  "entities": {
    // Extract key information like URLs, file paths, data types, etc.
  },
  "needsMultiAgent": true/false
}

Examples:
- "你好" → simple_chat (confidence: 0.95)
- "帮我搜索一下明天的天气" → complex_workflow (confidence: 0.9, needsMultiAgent: false)
- "爬取这个网站的数据，用Python分析，然后生成可视化图表" → complex_workflow (confidence: 0.95, needsMultiAgent: true)`;
}

