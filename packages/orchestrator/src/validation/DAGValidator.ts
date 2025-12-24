import type { Workflow, AgentNode } from '@monkey-agent/types';

/**
 * DAG 验证工具类
 * 
 * 提供 DAG（有向无环图）的验证、环检测和拓扑排序功能
 */
export class DAGValidator {
  /**
   * 检测环（使用 DFS）
   */
  static detectCycle(nodes: AgentNode[]): boolean {
    const graph = new Map<string, string[]>();
    nodes.forEach(node => {
      graph.set(node.id, node.dependencies);
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const deps = graph.get(nodeId) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (recStack.has(dep)) {
          return true; // 发现环
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * 拓扑排序（Kahn 算法）
   * 返回每一层可以并行执行的节点
   */
  static topologicalSort(nodes: AgentNode[]): string[][] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // 构建图和入度表
    nodes.forEach(node => {
      graph.set(node.id, []);
      inDegree.set(node.id, node.dependencies.length);
    });
    
    // 建立反向边（用于找到依赖此节点的节点）
    nodes.forEach(node => {
      node.dependencies.forEach(dep => {
        graph.get(dep)?.push(node.id);
      });
    });

    const levels: string[][] = [];
    const queue: string[] = [];
    
    // 找到所有入度为 0 的节点
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });

    while (queue.length > 0) {
      const currentLevel: string[] = [...queue];
      levels.push(currentLevel);
      queue.length = 0;

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

    return levels;
  }

  /**
   * 验证 DAG 有效性
   */
  static validate(workflow: Workflow): { valid: boolean; error?: string } {
    // 检查是否有环
    if (this.detectCycle(workflow.agentGraph)) {
      return { valid: false, error: 'Workflow contains circular dependencies' };
    }

    // 检查所有依赖的 ID 是否存在
    const allIds = new Set(workflow.agentGraph.map(a => a.id));
    for (const agent of workflow.agentGraph) {
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
    const hasStartNode = workflow.agentGraph.some(
      agent => agent.dependencies.length === 0
    );
    if (!hasStartNode) {
      return { valid: false, error: 'Workflow must have at least one agent with no dependencies' };
    }

    return { valid: true };
  }
}

