// ============ Core Classes ============
export { LLMClient } from './LLMClient';
export { ReasoningConfigBuilder } from './ReasoningConfigBuilder';

// ============ Constants & Presets ============
export {
  DEFAULT_MODELS,
  REASONING_PRESETS,
  CONFIG_LIMITS,
  SUPPORTED_PROVIDERS,
  PROVIDERS_WITHOUT_API_KEY,
  REASONING_EFFORT_OPTIONS,
  MODEL_ALIASES,
  resolveModelAlias,
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
