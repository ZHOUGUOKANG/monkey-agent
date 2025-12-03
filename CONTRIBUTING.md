# Contributing to Monkey Agent

感谢您对 Monkey Agent 项目的关注！我们欢迎各种形式的贡献。

## 📋 目录

- [如何贡献](#如何贡献)
- [开发环境设置](#开发环境设置)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [测试要求](#测试要求)

## 如何贡献

### 报告 Bug

如果您发现 bug，请[创建 Issue](https://github.com/yourusername/monkey-agent/issues/new?template=bug_report.md) 并提供以下信息：

- 清晰的标题和描述
- 重现步骤
- 预期行为 vs 实际行为
- 环境信息（Node.js 版本、操作系统等）
- 相关的代码示例或日志

### 提出新功能

如果您有功能建议，请[创建 Feature Request](https://github.com/yourusername/monkey-agent/issues/new?template=feature_request.md) 并说明：

- 功能的使用场景
- 预期的 API 设计
- 是否愿意实现该功能

### 改进文档

文档改进同样重要！您可以：

- 修正拼写或语法错误
- 改进示例代码
- 添加缺失的文档
- 翻译文档

## 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- Yarn >= 4.0.0
- Git

### 克隆仓库

```bash
git clone https://github.com/yourusername/monkey-agent.git
cd monkey-agent
```

### 安装依赖

```bash
yarn install
```

### 构建项目

```bash
yarn build
```

### 运行测试

```bash
yarn test
```

## 开发流程

### 1. Fork 仓库

点击右上角的 "Fork" 按钮创建您自己的副本。

### 2. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

**分支命名规范：**

- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关
- `chore/` - 构建/工具相关

### 3. 进行开发

- 编写代码
- 添加测试
- 更新文档
- 运行测试确保通过

### 4. 提交更改

```bash
git add .
git commit -m "feat: add new feature"
```

### 5. 推送到 Fork

```bash
git push origin feature/your-feature-name
```

### 6. 创建 Pull Request

在 GitHub 上创建 PR，填写 PR 模板中的信息。

## 代码规范

### TypeScript 规范

- 使用 TypeScript 编写所有代码
- 启用严格模式 (`strict: true`)
- 避免使用 `any`，使用 `unknown` 或具体类型
- 为公共 API 添加 JSDoc 注释
- 使用 `interface` 定义对象类型，`type` 定义联合类型

### 代码风格

项目使用 ESLint 和 Prettier 进行代码格式化：

```bash
# 检查代码风格
yarn lint

# 自动修复
yarn lint:fix

# 格式化代码
yarn format
```

### 命名约定

- **变量/函数**: camelCase (`getUserName`)
- **类/接口**: PascalCase (`UserManager`, `IAgent`)
- **常量**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **文件名**: kebab-case (`user-manager.ts`)
- **私有成员**: 前缀下划线 (`_privateMethod`)

### 目录结构

```
packages/
├── package-name/
│   ├── src/
│   │   ├── __tests__/        # 测试文件
│   │   ├── index.ts          # 导出入口
│   │   └── *.ts              # 源代码
│   ├── package.json
│   ├── README.md
│   ├── tsconfig.json
│   └── vite.config.ts
```

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关
- `ci`: CI 配置
- `revert`: 回退

### Scope (可选)

- `base` - BaseAgent 相关
- `llm` - LLM 客户端
- `agents` - Agent 实现
- `orchestrator` - 工作流编排
- `compression` - 上下文压缩
- `docs` - 文档
- `deps` - 依赖更新

### 示例

```bash
feat(llm): add support for Google Gemini

- Add Gemini provider configuration
- Update LLMClient to support Gemini models
- Add tests for Gemini integration

Closes #123
```

```bash
fix(base): resolve context compression issue

The compression logic was breaking tool-call pairs.
This commit ensures tool calls are always kept together.

Fixes #456
```

## Pull Request 流程

### PR 标题

遵循 Conventional Commits 规范，例如：

```
feat(agents): add ReportAgent for data analysis
fix(llm): handle rate limit errors properly
docs(readme): update installation instructions
```

### PR 描述

请使用 PR 模板，包含以下信息：

1. **变更说明** - 简要描述做了什么
2. **动机和上下文** - 为什么需要这个变更
3. **测试情况** - 如何测试的
4. **相关 Issue** - 关联的 Issue 编号
5. **截图/演示** - 如果适用
6. **Breaking Changes** - 是否包含破坏性变更

### Code Review

- 至少需要 1 位维护者批准
- 所有 CI 检查必须通过
- 解决所有 review 评论
- 保持 PR 小而专注（建议 < 500 行）

### 合并策略

- 使用 "Squash and merge" 保持历史清晰
- 确保 commit message 遵循规范
- 删除已合并的分支

## 测试要求

### 单元测试

- 新功能必须包含测试
- Bug 修复应包含回归测试
- 测试覆盖率应保持在 80% 以上

```bash
# 运行所有测试
yarn test

# 运行特定包的测试
cd packages/base && yarn test

# 生成覆盖率报告
yarn test --coverage
```

### 测试文件命名

- 单元测试: `*.test.ts`
- 集成测试: `*.integration.test.ts`
- E2E 测试: `*.e2e.test.ts` 或 `*.e2e.spec.ts`

### 测试结构

```typescript
import { describe, it, expect } from 'vitest';

describe('FeatureName', () => {
  it('should do something correctly', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = someFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## 发布流程

发布由维护者负责：

1. 更新版本号 (`yarn version`)
2. 更新 CHANGELOG.md
3. 创建 Git tag
4. 发布到 npm (`yarn publish:all`)
5. 创建 GitHub Release

## 获取帮助

如有问题，请：

- 查看 [文档](README.md)
- 搜索或创建 [Issue](https://github.com/yourusername/monkey-agent/issues)
- 加入 [Discord 社区](#) (TODO: 添加链接)

## 许可证

通过贡献，您同意您的贡献将在 [MIT 许可证](LICENSE) 下发布。

---

再次感谢您的贡献！ 🎉

