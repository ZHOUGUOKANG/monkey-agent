import { Task, TaskResult, Context } from '@monkey-agent/types';

/**
 * 经验记录
 */
export interface Experience {
  id: string;
  action: Action;
  result: TaskResult;
  context: Context;
  timestamp: Date;
  successRate?: number;
  usageCount?: number;
}

/**
 * 动作
 */
export interface Action {
  type: string;
  parameters: Record<string, any>;
  agentId: string;
}

/**
 * 经验系统
 * 记录和复用成功经验
 */
export class ExperienceSystem {
  private experiences: Map<string, Experience> = new Map();

  /**
   * 记录经验
   */
  record(action: Action, result: TaskResult, context: Context): void {
    const experience: Experience = {
      id: this.generateId(action, context),
      action,
      result,
      context,
      timestamp: new Date(),
      successRate: result.success ? 1.0 : 0.0,
      usageCount: 1,
    };

    // 如果已存在，更新成功率
    const existing = this.experiences.get(experience.id);
    if (existing) {
      experience.successRate = this.calculateSuccessRate(existing, result.success);
      experience.usageCount = (existing.usageCount || 0) + 1;
    }

    this.experiences.set(experience.id, experience);
  }

  /**
   * 检索相似经验
   */
  retrieve(context: Context, limit: number = 10): Experience[] {
    const results: { experience: Experience; score: number }[] = [];

    for (const exp of this.experiences.values()) {
      const score = this.calculateSimilarity(exp.context, context);
      if (score > 0.5) {
        // 相似度阈值
        results.push({ experience: exp, score });
      }
    }

    // 按得分排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit).map((r) => r.experience);
  }

  /**
   * 应用经验到新任务
   */
  apply(experience: Experience, task: Task): Task {
    // 复制经验中的成功参数
    const enhancedTask: Task = {
      ...task,
      parameters: {
        ...task.parameters,
        ...experience.action.parameters,
      },
      context: {
        ...task.context,
        metadata: {
          ...task.context?.metadata,
          appliedExperience: experience.id,
        },
      },
    };

    // 增加使用计数
    if (experience.usageCount !== undefined) {
      experience.usageCount++;
    }

    return enhancedTask;
  }

  /**
   * 获取最佳经验
   */
  getBestExperiences(actionType: string, limit: number = 5): Experience[] {
    const filtered = Array.from(this.experiences.values()).filter(
      (exp) => exp.action.type === actionType
    );

    // 按成功率和使用次数排序
    filtered.sort((a, b) => {
      const scoreA = (a.successRate || 0) * Math.log((a.usageCount || 0) + 1);
      const scoreB = (b.successRate || 0) * Math.log((b.usageCount || 0) + 1);
      return scoreB - scoreA;
    });

    return filtered.slice(0, limit);
  }

  /**
   * 清理低质量经验
   */
  cleanup(minSuccessRate: number = 0.3, minUsageCount: number = 3): void {
    for (const [id, exp] of this.experiences) {
      if (
        (exp.usageCount || 0) >= minUsageCount &&
        (exp.successRate || 0) < minSuccessRate
      ) {
        this.experiences.delete(id);
      }
    }
  }

  /**
   * 生成经验 ID
   */
  private generateId(action: Action, context: Context): string {
    const key = `${action.type}-${action.agentId}-${context.environment}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(existing: Experience, newSuccess: boolean): number {
    const count = existing.usageCount || 1;
    const currentRate = existing.successRate || 0;
    const newRate = newSuccess ? 1.0 : 0.0;

    return (currentRate * count + newRate) / (count + 1);
  }

  /**
   * 计算上下文相似度
   */
  private calculateSimilarity(ctx1: Context, ctx2: Context): number {
    let score = 0;

    // 环境匹配
    if (ctx1.environment === ctx2.environment) {
      score += 0.5;
    }

    // 用户匹配
    if (ctx1.userId && ctx1.userId === ctx2.userId) {
      score += 0.3;
    }

    // 会话匹配
    if (ctx1.sessionId === ctx2.sessionId) {
      score += 0.2;
    }

    return score;
  }

  /**
   * 导出经验数据
   */
  export(): Experience[] {
    return Array.from(this.experiences.values());
  }

  /**
   * 导入经验数据
   */
  import(experiences: Experience[]): void {
    for (const exp of experiences) {
      this.experiences.set(exp.id, exp);
    }
  }
}
