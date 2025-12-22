# E2B Sandbox 测试套件

这个目录包含了 E2B Sandbox 客户端的完整测试套件，包括集成测试、使用示例和测试辅助工具。

## 快速开始

```bash
# 设置 API Key
export E2B_API_KEY=your-api-key

# 运行所有测试
yarn workspace @monkey-agent/agents test

# 只运行集成测试
yarn test E2BSandboxClient.integration.test.ts

# 运行示例代码
tsx packages/agents/src/code/sandbox/__tests__/example.ts
```

## 测试文件

- `E2BSandboxClient.integration.test.ts` - E2B Sandbox 客户端的完整集成测试
- `example.ts` - E2B Sandbox 客户端的使用示例
- `test-helpers.ts` - 测试辅助工具和工具函数

## 运行测试

### 前置条件

1. **获取 E2B API Key**
   - 访问 [E2B 官网](https://e2b.dev/) 注册账号
   - 在控制台中创建 API Key

2. **设置环境变量**
   ```bash
   export E2B_API_KEY=your-api-key-here
   ```

### 运行所有测试

```bash
# 在项目根目录
yarn workspace @monkey-agent/agents test

# 或在 packages/agents 目录
cd packages/agents
yarn test
```

### 运行特定测试文件

```bash
# 只运行 E2B 集成测试
E2B_API_KEY=your-key yarn test E2BSandboxClient.integration.test.ts

# 使用 vitest 的过滤功能
yarn test --grep "E2BSandboxClient"
```

### 运行示例代码

```bash
# 运行使用示例
E2B_API_KEY=your-key tsx packages/agents/src/code/sandbox/__tests__/example.ts
```

### 在 CI/CD 中运行

在 CI/CD 环境中，将 E2B API Key 设置为环境变量：

```yaml
# GitHub Actions 示例
- name: Run E2B Integration Tests
  env:
    E2B_API_KEY: ${{ secrets.E2B_API_KEY }}
  run: yarn test
```

## 测试覆盖范围

### 1. Sandbox 生命周期管理
- ✅ 创建新的 Sandbox
- ✅ 关闭 Sandbox
- ✅ 列出所有 Sandbox
- ✅ 使用元数据过滤 Sandbox

### 2. 命令执行
- ✅ 执行简单的 Shell 命令
- ✅ 处理命令执行失败
- ✅ 执行多行命令
- ✅ 流式执行命令

### 3. 代码执行
- ✅ 执行 Python 代码
- ✅ 执行 JavaScript 代码
- ✅ 执行数学计算
- ✅ 处理代码执行错误
- ✅ 流式执行代码
- ✅ 执行复杂的 Python 脚本

### 4. 文件操作
- ✅ 上传和下载文件
- ✅ 通过命令创建和读取文件
- ✅ 处理二进制文件

### 5. 真实场景测试
- ✅ 安装 Python 包并使用
- ✅ 执行数据处理任务
- ✅ 创建和执行 Python 脚本文件
- ✅ 处理长时间运行的任务
- ✅ 执行环境信息查询

### 6. 错误处理和边界情况
- ✅ 没有 API Key 时抛出错误
- ✅ Sandbox 未创建时抛出错误
- ✅ 读取不存在的文件时处理错误
- ✅ 处理空代码执行
- ✅ 处理代码语法错误
- ✅ 处理运行时错误（如除零错误）

### 7. 并发测试
- ✅ 快速连续的命令执行
- ✅ 快速连续的代码执行
- ✅ 处理大量输出

### 8. 多语言支持测试
- ✅ 执行 TypeScript 代码
- ✅ 执行 Bash 脚本
- ✅ 执行 R 代码

### 9. 高级场景测试
- ✅ 多步骤工作流
- ✅ 内存密集型任务
- ✅ 多个 Python 包协同工作
- ✅ 异步操作处理
- ✅ 环境变量管理

### 10. Sandbox 重连和恢复测试
- ✅ 重新连接到现有 Sandbox
- ✅ 验证数据持久性
- ✅ 关闭后创建新 Sandbox

### 11. 资源管理和清理测试
- ✅ 管理多个并发 Sandbox
- ✅ 正确处理清理失败的情况

## 注意事项

### 测试成本
- E2B 的集成测试会创建真实的 Sandbox 实例
- 每次测试都会产生实际的 API 调用费用
- 建议在开发时适当控制测试频率

### 测试跳过
如果没有设置 `E2B_API_KEY` 环境变量，测试会自动跳过并输出警告信息：
```
⚠️  Skipping E2B integration tests: E2B_API_KEY not set
```

### 超时配置
集成测试需要更长的超时时间，已在 `vitest.config.ts` 中配置：
- `testTimeout: 60000` (60 秒)
- `hookTimeout: 60000` (60 秒)

### 清理资源
- 每个测试在 `afterAll` 钩子中会自动清理创建的 Sandbox
- 如果测试异常中断，可能需要手动清理 E2B 控制台中的 Sandbox

## 故障排查

### 测试超时
如果测试经常超时，可以：
1. 检查网络连接
2. 增加 `testTimeout` 配置
3. 在特定测试上使用 `.timeout()` 增加超时时间

### API 限流
如果遇到 API 限流错误：
1. 减少并发测试数量
2. 在测试之间增加延迟
3. 检查 E2B 账户的配额限制

### Sandbox 创建失败
如果 Sandbox 创建失败：
1. 确认 API Key 有效
2. 检查 E2B 账户状态
3. 验证使用的模板 ID（默认为 'base'）是否可用

## 测试辅助工具

项目提供了 `test-helpers.ts` 文件，包含常用的测试辅助函数：

### TestSandboxManager
自动管理 Sandbox 的创建和清理：

```typescript
import { TestSandboxManager } from './test-helpers';

const manager = new TestSandboxManager();

// 创建单个 Sandbox
const client = await manager.createSandbox();

// 创建多个 Sandbox
const clients = await manager.createMultipleSandboxes(3);

// 自动清理所有 Sandbox
await manager.cleanup();
```

### 断言辅助函数
简化测试断言：

```typescript
import { assertions } from './test-helpers';

// 断言命令成功
assertions.assertCommandSuccess(result, 'expected output');

// 断言代码执行成功
assertions.assertCodeSuccess(result, 'expected output');

// 断言代码执行失败
assertions.assertCodeError(result, 'ZeroDivisionError');
```

### 测试代码片段
预定义的测试代码：

```typescript
import { testCode } from './test-helpers';

// 使用预定义的 Python 代码
const result = await client.runCode(testCode.python.helloWorld, 'python');
const result2 = await client.runCode(testCode.python.dataProcessing, 'python');
```

### 测试数据生成
生成测试用的数据：

```typescript
import { testData } from './test-helpers';

const csv = testData.generateCSV(100); // 生成 100 行 CSV
const json = testData.generateJSON(50); // 生成 50 条 JSON 记录
const str = testData.randomString(32); // 生成 32 字符随机字符串
```

## 贡献指南

添加新的测试时，请遵循以下规范：

1. **使用描述性的测试名称**
   ```typescript
   it('应该能够执行 Python 代码', async () => {
     // ...
   });
   ```

2. **包含适当的断言**
   - 验证成功情况
   - 验证错误处理
   - 检查边界条件

3. **清理测试资源**
   - 在 `beforeEach` 中创建 Sandbox
   - 在 `afterAll` 中清理资源
   - 或使用 `TestSandboxManager` 自动管理

4. **添加超时注释**
   ```typescript
   it('长时间运行的测试', async () => {
     // ...
   }, 30000); // 30 秒超时
   ```

5. **检查 API Key**
   ```typescript
   import { skipIfNoApiKey } from './test-helpers';
   
   if (skipIfNoApiKey()) return;
   ```

6. **使用测试辅助工具**
   - 使用 `TestSandboxManager` 管理 Sandbox
   - 使用 `assertions` 简化断言
   - 使用 `testCode` 和 `testData` 避免重复代码

## 相关资源

- [E2B 官方文档](https://e2b.dev/docs)
- [E2B Code Interpreter SDK](https://github.com/e2b-dev/code-interpreter)
- [Vitest 文档](https://vitest.dev/)
- [E2B 定价](https://e2b.dev/pricing) - 了解 API 调用成本
