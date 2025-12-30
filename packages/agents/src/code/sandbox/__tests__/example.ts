/**
 * E2B Sandbox 客户端使用示例
 * 
 * 这个文件演示了如何使用 E2BSandboxClient
 * 
 * 配置方式：
 * 1. 在项目根目录创建 .env 文件，添加: E2B_API_KEY=your-key
 * 2. 或设置环境变量: export E2B_API_KEY=your-key
 * 
 * 运行方式：
 * yarn example:e2b
 */

import { E2BSandboxClient } from '../E2BSandboxClient';
import { loadEnvFile } from '@monkey-agent/utils';
import * as path from 'path';

async function main() {
  // 加载 .env 文件
  const rootEnvPath = path.resolve(__dirname, '../../../../../.env');
  loadEnvFile({ 
    envPath: rootEnvPath,
    verbose: true, // 示例中显示加载信息
  });

  // 检查 API Key
  if (!process.env.E2B_API_KEY) {
    console.error('\n❌ 请设置 E2B_API_KEY');
    console.log('\n方式 1: 在项目根目录创建 .env 文件');
    console.log('  E2B_API_KEY=your-api-key\n');
    console.log('方式 2: 设置环境变量');
    console.log('  export E2B_API_KEY=your-api-key\n');
    process.exit(1);
  }

  console.log('🚀 E2B Sandbox 客户端示例\n');

  // 创建客户端
  const client = new E2BSandboxClient(process.env.E2B_API_KEY);

  try {
    // 1. 创建 Sandbox
    console.log('📦 创建 Sandbox...');
    await client.create('base', 'example-user', 'example-task', {
      example: 'true',
    });
    console.log(`✅ Sandbox 已创建: ${client.sandboxId}\n`);

    // 2. 执行简单命令
    console.log('🔧 执行 Shell 命令...');
    const cmdResult = await client.runCommand('echo "Hello from E2B!" && pwd');
    if ('stdout' in cmdResult) {
      console.log('输出:', cmdResult.stdout);
      console.log('退出码:', cmdResult.exit_code);
      console.log();
    }

    // 3. 执行 Python 代码
    console.log('🐍 执行 Python 代码...');
    const pythonCode = `
import math
import json

result = {
    "message": "Hello from Python!",
    "pi": math.pi,
    "calculation": 42 * 2
}

print(json.dumps(result, indent=2))
`;
    const pyResult = await client.runCode(pythonCode, 'python');
    if ('stdout' in pyResult) {
      console.log('Python 输出:');
      console.log(pyResult.stdout || pyResult.result);
      console.log();
    }

    // 4. 数据处理示例
    console.log('📊 数据处理示例...');
    const dataProcessingCode = `
# 模拟数据分析任务
data = [10, 20, 30, 40, 50]

average = sum(data) / len(data)
maximum = max(data)
minimum = min(data)

print(f"数据: {data}")
print(f"平均值: {average}")
print(f"最大值: {maximum}")
print(f"最小值: {minimum}")
`;
    const dataResult = await client.runCode(dataProcessingCode, 'python');
    if ('stdout' in dataResult) {
      console.log(dataResult.stdout || dataResult.result);
      console.log();
    }

    // 5. 安装并使用第三方包
    console.log('📦 安装第三方包...');
    const installResult = await client.runCommand('pip install requests -q');
    if ('exit_code' in installResult && installResult.exit_code === 0) {
      console.log('✅ requests 包安装成功\n');

      console.log('🔍 使用 requests 包...');
      const requestsCode = `
import requests

# 获取包信息
print(f"requests 版本: {requests.__version__}")
print("requests 包已成功导入！")
`;
      const reqResult = await client.runCode(requestsCode, 'python');
      if ('stdout' in reqResult) {
        console.log(reqResult.stdout || reqResult.result);
        console.log();
      }
    }

    // 6. 文件操作
    console.log('📁 文件操作示例...');
    const fileOpsCode = `
# 写入文件
with open('/tmp/test.txt', 'w') as f:
    f.write('Hello, File System!')

# 读取文件
with open('/tmp/test.txt', 'r') as f:
    content = f.read()
    print(f"文件内容: {content}")

# 列出文件
import os
print(f"临时目录内容: {os.listdir('/tmp')[:5]}")  # 只显示前5个
`;
    const fileResult = await client.runCode(fileOpsCode, 'python');
    if ('stdout' in fileResult) {
      console.log(fileResult.stdout || fileResult.result);
      console.log();
    }

    // 7. 流式执行示例
    console.log('🌊 流式执行示例...');
    const streamCode = `
import time

for i in range(3):
    print(f"步骤 {i+1}/3")
    time.sleep(0.3)

print("完成！")
`;
    const stream = await client.runCode(streamCode, 'python', true);
    if (Symbol.asyncIterator in stream) {
      console.log('流式输出:');
      for await (const chunk of stream) {
        if (chunk.type === 'stdout' || chunk.type === 'result') {
          console.log(`  [${chunk.type}] ${chunk.content}`);
        }
      }
      console.log();
    }

    // 8. 错误处理示例
    console.log('⚠️  错误处理示例...');
    const errorCode = 'print(undefined_variable)';
    const errorResult = await client.runCode(errorCode, 'python');
    if ('error' in errorResult && errorResult.error) {
      console.log('捕获到预期的错误:');
      console.log(`  错误类型: ${errorResult.error.name}`);
      console.log(`  错误信息: ${errorResult.error.value}`);
      console.log();
    }

    // 9. 列出所有 Sandbox
    console.log('📋 列出所有 Sandbox...');
    const sandboxes = await client.list();
    console.log(`找到 ${sandboxes.length} 个 Sandbox`);
    if (sandboxes.length > 0) {
      console.log('最近的 Sandbox:');
      sandboxes.slice(0, 3).forEach((sb, i) => {
        console.log(`  ${i + 1}. ${sb.sandbox_id} (模板: ${sb.template_id})`);
      });
      console.log();
    }

    console.log('✅ 所有示例执行完成！\n');
  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    // 清理资源
    console.log('🧹 关闭 Sandbox...');
    await client.close();
    console.log('✅ 资源已清理');
  }
}

// 运行主函数
main().catch(console.error);
