// ============ Core Classes ============
export { LLMClient } from './LLMClient';
export { ReasoningConfigBuilder } from './ReasoningConfigBuilder';

// ============ Message Builder Utilities ============
export { buildAssistantMessage, buildToolResultMessage } from './message-builders';

// ============ Constants & Presets ============
export {
  REASONING_PRESETS,
  CONFIG_LIMITS,
  SUPPORTED_PROVIDERS,
  PROVIDERS_WITHOUT_API_KEY,
  REASONING_EFFORT_OPTIONS,
} from './constants';

// ============ Types from Core ============
export type { 
  LLMConfig, 
  LLMCallOptions, 
  LLMChatResult, 
  LLMProvider,
  ReasoningConfig,
  EmbeddingOptions,
  EmbedManyOptions,
  EmbedResult,
  EmbedManyResult,
} from '@monkey-agent/types';

// ============ Vercel AI SDK Types ============
export type { 
  ModelMessage,
  SystemModelMessage,
  UserModelMessage,
  AssistantModelMessage,
  ToolModelMessage,
  Tool,
  ToolChoice,
  ToolSet,
  StreamTextResult,
  TextStreamPart,
  GenerateTextResult,
  LanguageModel,
  LanguageModelMiddleware,
  EmbeddingModel,
} from 'ai';

// ============ Utilities from AI SDK ============
export { tool, cosineSimilarity } from 'ai';
export { z } from 'zod';
