# @monkey-agent/logger

统一的日志组件，支持分级日志、上下文标签、时间戳、彩色输出。

## 特性

- 分级日志：DEBUG / INFO / WARN / ERROR / SILENT
- 上下文标签：标识日志来源
- 时间戳：ISO 8601 格式
- 彩色输出：自动检测 TTY
- 结构化日志：可选 JSON 格式
- 环境变量控制：`LOG_LEVEL`

## 使用方法

```typescript
import { Logger, LogLevel } from '@monkey-agent/logger';

// 创建 Logger 实例
const logger = new Logger('MyComponent');

// 基础日志
logger.debug('Debug message', { key: 'value' });
logger.info('Info message');
logger.warn('Warning message', { reason: 'timeout' });
logger.error('Error message', error);

// 流式输出专用（debug 级别）
logger.stream(streamPart);

// 创建子 Logger
const childLogger = logger.child('SubComponent');
```

## 环境变量

```bash
# 设置日志级别
LOG_LEVEL=debug   # 显示所有日志
LOG_LEVEL=info    # 默认，显示 info/warn/error
LOG_LEVEL=warn    # 只显示 warn/error
LOG_LEVEL=error   # 只显示 error
LOG_LEVEL=silent  # 不显示任何日志
```

## API

### Logger

#### 构造函数

```typescript
constructor(context: string, config?: Partial<LoggerConfig>)
```

#### 方法

- `debug(message: string, data?: any)` - DEBUG 级别日志
- `info(message: string, data?: any)` - INFO 级别日志
- `warn(message: string, data?: any)` - WARN 级别日志
- `error(message: string, data?: any)` - ERROR 级别日志
- `stream(part: any)` - 流式输出专用（DEBUG 级别）
- `child(context: string)` - 创建子 Logger
- `setLevel(level: LogLevel)` - 设置日志级别
- `getLevel()` - 获取当前日志级别

### LogLevel 枚举

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 99
}
```

### LoggerConfig 接口

```typescript
interface LoggerConfig {
  level?: LogLevel;
  context?: string;
  enableColor?: boolean;
  enableTimestamp?: boolean;
  structured?: boolean;
}
```

## 输出示例

```
[2025-12-25T03:02:51.301Z] [ReactLoop] [DEBUG] [STREAM] tool-call {
  "type": "tool-call",
  "toolCallId": "...",
  "toolName": "getWeather"
}

[2025-12-25T03:02:52.123Z] [BaseAgent] [INFO] Agent started { taskId: '123' }
[2025-12-25T03:02:53.456Z] [ReactLoop] [WARN] High token usage { tokens: 5000 }
[2025-12-25T03:02:54.789Z] [BaseAgent] [ERROR] Tool execution failed Error: ...
```

