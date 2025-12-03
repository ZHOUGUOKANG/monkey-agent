export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // Bug 修复
        'docs',     // 文档更新
        'style',    // 代码格式
        'refactor', // 重构
        'perf',     // 性能优化
        'test',     // 测试相关
        'chore',    // 构建/工具
        'ci',       // CI 配置
        'revert',   // 回退
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'base',
        'agents',
        'llm',
        'orchestrator',
        'compression',
        'context',
        'memory',
        'utils',
        'tools',
        'types',
        'logger',
        'docs',
        'deps',
        'ci',
      ],
    ],
    'subject-case': [0],
  },
};

