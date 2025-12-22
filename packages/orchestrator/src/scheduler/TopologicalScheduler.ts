/**
 * 拓扑排序调度器
 */

import type { AgentNode } from '@monkey-agent/types';
import type { IScheduler } from '../types';

/**
 * 拓扑排序调度器
 * 
 * 使用 Kahn 算法进行拓扑排序,将 DAG 分解为多个层级
 * 同一层级的节点可以并行执行
 */
export class TopologicalScheduler implements IScheduler {
  /**
   * 拓扑排序,返回执行层级
   * 每层包含可并行执行的 Agent IDs
   * 
   * @param agentGraph Agent DAG 图
   * @returns 按层级分组的 Agent ID 数组
   */
  schedule(agentGraph: AgentNode[]): string[][] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // 构建图和入度表
    agentGraph.forEach(node => {
      graph.set(node.id, []);
      inDegree.set(node.id, node.dependencies.length);
    });
    
    // 建立反向边(用于找到依赖此节点的节点)
    agentGraph.forEach(node => {
      node.dependencies.forEach(dep => {
        const neighbors = graph.get(dep);
        if (neighbors) {
          neighbors.push(node.id);
        }
      });
    });

    const levels: string[][] = [];
    const queue: string[] = [];
    
    // 找到所有入度为 0 的节点(起始节点)
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });

    // BFS 遍历
    while (queue.length > 0) {
      // 当前层级的所有节点
      const currentLevel: string[] = [...queue];
      levels.push(currentLevel);
      queue.length = 0;

      // 处理当前层级的每个节点
      for (const nodeId of currentLevel) {
        const neighbors = graph.get(nodeId) || [];
        for (const neighbor of neighbors) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    // 检查是否所有节点都被处理(检测环)
    const processedNodes = levels.flat().length;
    if (processedNodes !== agentGraph.length) {
      throw new Error(
        `Circular dependency detected or unreachable nodes. ` +
        `Processed ${processedNodes} nodes, expected ${agentGraph.length}`
      );
    }

    return levels;
  }

  /**
   * 验证 DAG 有效性
   * 
   * @param agentGraph Agent DAG 图
   * @returns 验证结果
   */
  validate(agentGraph: AgentNode[]): { valid: boolean; error?: string } {
    // 检查是否有节点
    if (agentGraph.length === 0) {
      return { valid: false, error: 'Agent graph is empty' };
    }

    // 检查所有依赖的 ID 是否存在
    const allIds = new Set(agentGraph.map(a => a.id));
    for (const agent of agentGraph) {
      for (const dep of agent.dependencies) {
        if (!allIds.has(dep)) {
          return { 
            valid: false, 
            error: `Agent ${agent.id} depends on non-existent agent ${dep}` 
          };
        }
      }
    }

    // 检查是否至少有一个入度为 0 的节点
    const hasStartNode = agentGraph.some(
      agent => agent.dependencies.length === 0
    );
    if (!hasStartNode) {
      return { 
        valid: false, 
        error: 'Workflow must have at least one agent with no dependencies' 
      };
    }

    // 尝试拓扑排序以检测环
    try {
      this.schedule(agentGraph);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

