# Monkey Agent Web

基于 React 19 + Ant Design 6 的现代化 Web 前端应用。

## 技术栈

- React 19
- Ant Design 6
- TypeScript 5
- Vite 6
- Zustand 5 (状态管理)
- Socket.IO Client (WebSocket 通信)
- dayjs (日期处理)

## 开发

```bash
# 安装依赖
yarn install

# 启动开发服务器
yarn dev  # http://localhost:5173
```

## 构建

```bash
# 构建生产版本
yarn build  # 输出到 dist/
```

## 特性

- 💬 对话页面 - 与 AI Agent 实时交互
- 📝 历史记录 - 保存和管理对话历史
- 📊 实时日志 - 查看系统运行日志
- 🌙 深色模式 - 支持浅色/深色主题切换
- 🔗 实时连接 - WebSocket 实时通信

## 项目结构

```
src/
├── components/     # UI 组件
├── layouts/        # 布局组件
├── pages/          # 页面组件
├── services/       # 服务层（WebSocket, Storage, Logger）
├── stores/         # 状态管理（Zustand）
├── styles/         # 样式文件
└── types/          # TypeScript 类型定义
```

