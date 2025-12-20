/**
 * 意图识别相关类型定义
 */

/**
 * 意图类型
 */
export enum IntentType {
  /** 简单对话 - 闲聊、问答、一般性咨询 */
  SIMPLE_CHAT = 'simple_chat',
  /** 复杂工作流 - 需要执行的任务（单个或多个 Agent 协作） */
  COMPLEX_WORKFLOW = 'complex_workflow',
  /** 信息查询 - 查询信息、检索数据 */
  INFORMATION_QUERY = 'information_query',
  /** 不确定 - 需要进一步澄清 */
  UNCERTAIN = 'uncertain',
}

/**
 * 意图识别结果
 */
export interface IntentRecognitionResult {
  /** 识别的意图类型 */
  intent: IntentType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 解释 */
  explanation: string;
  /** 提取的关键信息 */
  entities?: Record<string, any>;
  /** 是否需要多智能体协作 */
  needsMultiAgent: boolean;
}

