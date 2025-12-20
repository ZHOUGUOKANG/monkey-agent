/**
 * Agents Package - 智能体实现集合
 * 
 * 新架构（前后端分离）：
 * - 所有 Agent 运行在 Node.js 服务端
 * - 使用 Playwright 替代 Chrome Extension APIs
 * - Chrome 插件仅作为纯 UI 层
 * 
 * Agent 实现状态：
 * ✅ BrowserAgent - 浏览器操作（9/9 工具）
 * ✅ ComputerAgent - 系统控制（17/17 工具：5个计算机控制 + 8个文件操作 + 4个Shell命令）
 * ✅ ChatAgent - 对话和工作流生成（3/3 工具）
 * ✅ CodeAgent - 代码执行（5/5 工具，依赖 E2B）
 * ✅ ReportAgent - 报告生成（3/3 工具：数据提取、分析、可视化）
 */

// ============ 浏览器 Agent（Playwright 版本） ============
export { BrowserAgent } from './browser/BrowserAgent';
export type { BrowserAgentConfig } from './browser/BrowserAgent';

// ============ 系统 Agent（统一的计算机控制） ============
export { ComputerAgent } from './system/ComputerAgent';
export type { ComputerAgentConfig } from './system/ComputerAgent';
// 注释: ComputerAgent 包含计算机控制、文件操作和 Shell 命令功能

// ============ 对话 Agent ============
export { ChatAgent } from './chat/ChatAgent';
export type { ChatAgentConfig } from './chat/ChatAgent';

// ============ 代码执行 Agent ============
export { CodeAgent } from './code/CodeAgent';
export type { CodeAgentConfig } from './code/CodeAgent';

// ============ 报告生成 Agent ============
export { ReportAgent } from './report/ReportAgent';
export type { ReportAgentConfig } from './report/ReportAgent';
export { CodeGenerator } from './report/CodeGenerator';
export type { ReportConfig, ComponentConfig } from './report/CodeGenerator';

// ============ 废弃说明 ============
// 以下 Agent 已被移除或重命名：
// - BrowserAgent (Chrome Extension 版本) → 使用 BrowserAgent (Playwright 版本)
// - PlaywrightBrowserAgent → 重命名为 BrowserAgent
// - NodeComputerAgent → 重命名为 ComputerAgent
// - NodeFileAgent → 已合并到 ComputerAgent
// - NodeShellAgent → 已合并到 ComputerAgent
// - ImageAgent → 已删除（后续单独处理）
