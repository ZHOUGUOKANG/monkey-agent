export interface ToolInputProgress {
  id: string;
  toolName: string;
  status: 'receiving' | 'complete';
  charCount: number;
  fullContent: string; // 前端累积的完整内容
  duration?: number;
}

