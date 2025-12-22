import { extractReasoningMiddleware } from 'ai';
import type { LanguageModelMiddleware } from 'ai';
import { ReasoningConfig } from '@monkey-agent/types';

/**
 * 推理配置构建器
 * 
 * 负责将统一的 ReasoningConfig 转换为不同提供商的特定配置格式。
 * 分离关注点，使推理配置逻辑更清晰、可维护。
 */
export class ReasoningConfigBuilder {
  /**
   * 构建 middleware（用于标签提取模式）
   * 
   * @param reasoning 推理配置
   * @returns LanguageModelMiddleware 或 undefined
   * 
   * @example
   * ```typescript
   * const middleware = ReasoningConfigBuilder.buildMiddleware({
   *   tagName: 'think'
   * });
   * ```
   */
  static buildMiddleware(reasoning?: ReasoningConfig): LanguageModelMiddleware | undefined {
    if (!reasoning || reasoning.disabled || !reasoning.tagName) {
      return undefined;
    }
    
    return extractReasoningMiddleware({ tagName: reasoning.tagName }) as LanguageModelMiddleware;
  }

  /**
   * 构建 providerOptions（用于提供商特定的推理配置）
   * 
   * @param reasoning 推理配置
   * @returns Provider-specific options
   * 
   * @example
   * ```typescript
   * const options = ReasoningConfigBuilder.buildProviderOptions({
   *   effort: 'high',
   *   thinking: true
   * });
   * // 返回: { openai: { reasoning_effort: 'high' }, anthropic: { thinking: { type: 'enabled' } } }
   * ```
   */
  static buildProviderOptions(reasoning?: ReasoningConfig): Record<string, any> {
    if (!reasoning || reasoning.disabled) {
      return {};
    }
    
    const options: Record<string, any> = {};
    
    // OpenAI o1 系列配置
    const openaiOptions = this.buildOpenAIOptions(reasoning);
    if (openaiOptions) {
      options.openai = openaiOptions;
    }
    
    // Anthropic Claude 配置
    const anthropicOptions = this.buildAnthropicOptions(reasoning);
    if (anthropicOptions) {
      options.anthropic = anthropicOptions;
    }
    
    // Amazon Bedrock 配置
    const bedrockOptions = this.buildBedrockOptions(reasoning);
    if (bedrockOptions) {
      options.bedrock = bedrockOptions;
    }
    
    // Google Vertex 配置
    const vertexOptions = this.buildVertexOptions(reasoning);
    if (vertexOptions) {
      options.google = vertexOptions;
    }
    
    return options;
  }

  /**
   * 构建 OpenAI 特定的推理配置
   * 
   * @param reasoning 推理配置
   * @returns OpenAI reasoning options
   * 
   * @example
   * ```typescript
   * const options = buildOpenAIOptions({ effort: 'high' });
   * // 返回: { reasoning_effort: 'high' }
   * ```
   */
  private static buildOpenAIOptions(reasoning: ReasoningConfig): Record<string, any> | undefined {
    if (!reasoning.effort) {
      return undefined;
    }
    
    return {
      reasoning_effort: reasoning.effort
    };
  }

  /**
   * 构建 Anthropic Claude 特定的推理配置
   * 
   * @param reasoning 推理配置
   * @returns Anthropic thinking options
   * 
   * @example
   * ```typescript
   * const options = buildAnthropicOptions({ thinking: true });
   * // 返回: { thinking: { type: 'enabled' } }
   * 
   * const options2 = buildAnthropicOptions({ thinking: 5000 });
   * // 返回: { thinking: { type: 'enabled', budgetTokens: 5000 } }
   * ```
   */
  private static buildAnthropicOptions(reasoning: ReasoningConfig): Record<string, any> | undefined {
    if (reasoning.thinking === undefined) {
      return undefined;
    }
    
    type ThinkingConfig = {
      type: 'enabled' | 'disabled';
      budgetTokens?: number;
    };
    
    const thinking: ThinkingConfig = { type: 'disabled' };
    
    if (typeof reasoning.thinking === 'boolean') {
      // true: 启用自动模式, false: 禁用
      thinking.type = reasoning.thinking ? 'enabled' : 'disabled';
    } else if (typeof reasoning.thinking === 'number') {
      // 数字: 启用并设置预算
      thinking.type = 'enabled';
      thinking.budgetTokens = reasoning.thinking;
    }
    
    return { thinking };
  }

  /**
   * 构建 Amazon Bedrock 特定的推理配置
   * 
   * 支持 Anthropic models 和 Amazon Nova models
   * 
   * @param reasoning 推理配置
   * @returns Bedrock reasoning options
   * 
   * @example
   * ```typescript
   * const options = buildBedrockOptions({ budgetTokens: 12000 });
   * // 返回: { reasoningConfig: { type: 'enabled', budgetTokens: 12000 } }
   * ```
   */
  private static buildBedrockOptions(reasoning: ReasoningConfig): Record<string, any> | undefined {
    if (!reasoning.budgetTokens && !reasoning.maxReasoningEffort) {
      return undefined;
    }
    
    const reasoningConfig: Record<string, any> = {};
    
    if (reasoning.budgetTokens) {
      reasoningConfig.type = 'enabled';
      reasoningConfig.budgetTokens = reasoning.budgetTokens;
    }
    
    if (reasoning.maxReasoningEffort) {
      reasoningConfig.type = 'enabled';
      reasoningConfig.maxReasoningEffort = reasoning.maxReasoningEffort;
    }
    
    return { reasoningConfig };
  }

  /**
   * 构建 Google Vertex 特定的推理配置
   * 
   * @param reasoning 推理配置
   * @returns Vertex thinking options
   * 
   * @example
   * ```typescript
   * const options = buildVertexOptions({ 
   *   includeThoughts: true, 
   *   thinkingBudget: 2048 
   * });
   * // 返回: { thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 } }
   * ```
   */
  private static buildVertexOptions(reasoning: ReasoningConfig): Record<string, any> | undefined {
    if (reasoning.includeThoughts === undefined && !reasoning.thinkingBudget) {
      return undefined;
    }
    
    const thinkingConfig: Record<string, any> = {};
    
    if (reasoning.includeThoughts !== undefined) {
      thinkingConfig.includeThoughts = reasoning.includeThoughts;
    }
    
    if (reasoning.thinkingBudget) {
      thinkingConfig.thinkingBudget = reasoning.thinkingBudget;
    }
    
    return { thinkingConfig };
  }
}
