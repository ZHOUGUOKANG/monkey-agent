# Image Agent 能力文档

Image Agent 是 Monkey Agent 系统中专门负责图像生成、编辑、分析和处理的智能体。

## 核心定位

Image Agent 提供全方位的图像处理能力，支持多种 AI 图像服务提供商，能够执行从简单的格式转换到复杂的 AI 驱动的图像生成和编辑任务。

## 能力矩阵

### 1. 图像生成能力

| 能力 | 工具名称 | 描述 | 参数 |
|------|---------|------|------|
| **文本生成图像** | `generateImage` | 根据文本描述生成全新图像 | prompt, negativePrompt, size, style, quality, model |
| **图像变体生成** | `createVariation` | 基于已有图像创建不同版本 | imageUrl, numberOfVariations |

#### generateImage 详细说明

```typescript
generateImage({
  prompt: string,              // 图像描述（必填）
  negativePrompt?: string,     // 排除元素描述
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792',
  style?: 'natural' | 'vivid' | 'artistic' | 'photographic',
  quality?: 'standard' | 'hd',
  model?: string               // 覆盖默认模型
})
```

**支持的图像尺寸**：
- `256x256` - 小尺寸，快速生成
- `512x512` - 标准尺寸
- `1024x1024` - 方形高清
- `1792x1024` - 横向宽屏
- `1024x1792` - 纵向长图

**风格选项**：
- `natural` - 自然真实风格
- `vivid` - 鲜艳生动风格
- `artistic` - 艺术风格
- `photographic` - 摄影风格

### 2. 图像编辑能力

| 能力 | 工具名称 | 描述 | 参数 |
|------|---------|------|------|
| **通用编辑** | `editImage` | 根据指令编辑图像 | imageUrl, prompt, maskUrl? |
| **局部修复** | `inpaintImage` | 修复或替换图像指定区域 | imageUrl, maskUrl, prompt |
| **边缘扩展** | `outpaintImage` | 向外扩展图像边界 | imageUrl, direction, prompt |
| **图像放大** | `upscaleImage` | 提升图像分辨率 | imageUrl, scale? |

#### inpaintImage 详细说明

```typescript
inpaintImage({
  imageUrl: string,      // 源图像 URL
  maskUrl: string,       // 遮罩图像（白色=修改区域，黑色=保留区域）
  prompt: string         // 修改区域的描述
})
```

**使用场景**：
- 移除图像中的不需要的对象
- 替换图像中的特定元素
- 修复图像损坏或模糊区域
- 添加新元素到图像中

#### outpaintImage 详细说明

```typescript
outpaintImage({
  imageUrl: string,
  direction: 'up' | 'down' | 'left' | 'right' | 'all',
  prompt: string         // 扩展区域的内容描述
})
```

**扩展方向**：
- `up` - 向上扩展
- `down` - 向下扩展
- `left` - 向左扩展
- `right` - 向右扩展
- `all` - 四个方向同时扩展

### 3. 图像分析能力

| 能力 | 工具名称 | 描述 | 参数 |
|------|---------|------|------|
| **内容分析** | `analyzeImage` | 识别图像中的对象、场景、颜色等 | imageUrl, analysisType? |
| **图像描述** | `describeImage` | 生成详细的文本描述 | imageUrl, detailLevel? |
| **文字提取** | `extractTextFromImage` | OCR 文字识别 | imageUrl, language? |

#### analyzeImage 详细说明

```typescript
analyzeImage({
  imageUrl: string,
  analysisType?: 'objects' | 'scene' | 'colors' | 'text' | 'faces' | 'all'
})
```

**分析类型**：
- `objects` - 识别图像中的物体
- `scene` - 场景分析（室内/室外、环境等）
- `colors` - 主色调分析
- `text` - 图像中的文字检测
- `faces` - 人脸检测和属性
- `all` - 全面分析（默认）

**返回信息示例**：
```json
{
  "objects": ["laptop", "desk", "coffee cup"],
  "scene": "indoor office workspace",
  "dominantColors": ["#2C3E50", "#ECF0F1", "#E74C3C"],
  "textDetected": true,
  "faces": 0
}
```

#### describeImage 详细说明

```typescript
describeImage({
  imageUrl: string,
  detailLevel?: 'brief' | 'detailed' | 'comprehensive'
})
```

**详细程度**：
- `brief` - 简要描述（1-2 句话）
- `detailed` - 详细描述（一段话）
- `comprehensive` - 全面描述（多段落，包含细节）

### 4. 图像处理能力

| 能力 | 工具名称 | 描述 | 参数 |
|------|---------|------|------|
| **风格转换** | `transferStyle` | 将一张图片的风格应用到另一张 | contentImageUrl, styleImageUrl, strength? |
| **背景移除** | `removeBackground` | 移除图像背景 | imageUrl, format? |
| **调整大小** | `resizeImage` | 改变图像尺寸 | imageUrl, width, height, maintainAspectRatio? |
| **裁剪** | `cropImage` | 裁剪图像指定区域 | imageUrl, x, y, width, height |
| **格式转换** | `convertFormat` | 转换图像格式 | imageUrl, targetFormat, quality? |
| **优化压缩** | `optimizeImage` | 优化文件大小 | imageUrl, quality?, maxFileSize? |

#### transferStyle 详细说明

```typescript
transferStyle({
  contentImageUrl: string,    // 内容图像（保留结构）
  styleImageUrl: string,      // 风格参考图像
  strength?: number           // 风格强度 (0-1)，默认 0.7
})
```

**应用场景**：
- 将照片转换为绘画风格
- 应用艺术家风格到普通图像
- 创建独特的艺术效果

#### resizeImage 详细说明

```typescript
resizeImage({
  imageUrl: string,
  width: number,              // 目标宽度（像素）
  height: number,             // 目标高度（像素）
  maintainAspectRatio?: boolean  // 是否保持长宽比
})
```

**处理策略**：
- `maintainAspectRatio: true` - 保持比例，可能需要裁剪或填充
- `maintainAspectRatio: false` - 强制缩放到指定尺寸

#### convertFormat 详细说明

```typescript
convertFormat({
  imageUrl: string,
  targetFormat: 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp',
  quality?: number            // 1-100，用于有损格式
})
```

**格式特点**：
- `jpeg` - 有损压缩，适合照片，不支持透明
- `png` - 无损压缩，支持透明，适合图标
- `webp` - 现代格式，体积小，支持透明
- `gif` - 支持动画，有限色彩
- `bmp` - 无压缩，体积大

## 服务提供商

Image Agent 支持多个图像生成服务：

### OpenAI DALL-E

```typescript
const imageAgent = new ImageAgent({
  imageProvider: 'openai',
  imageApiKey: 'sk-...',
  defaultModel: 'dall-e-3'
});
```

**支持的模型**：
- `dall-e-3` - 最新版本，质量最高
- `dall-e-2` - 较快，性价比高

**特性**：
- ✅ 文本生成图像
- ✅ 图像编辑
- ✅ 图像变体
- ❌ 图像分析（需要 GPT-4 Vision）

### Replicate

```typescript
const imageAgent = new ImageAgent({
  imageProvider: 'replicate',
  imageApiKey: 'r8_...',
  defaultModel: 'stability-ai/sdxl'
});
```

**支持的模型系列**：
- Stable Diffusion XL
- Midjourney Alternatives
- 风格转换模型
- 图像放大模型

**特性**：
- ✅ 多种开源模型
- ✅ 自定义模型部署
- ✅ 按需付费

### Stability AI

```typescript
const imageAgent = new ImageAgent({
  imageProvider: 'stability',
  imageApiKey: 'sk-...',
  defaultModel: 'stable-diffusion-xl-1024-v1-0'
});
```

**支持的模型**：
- Stable Diffusion XL
- Stable Diffusion 2.1
- 专业编辑模型

**特性**：
- ✅ 高质量图像生成
- ✅ Inpainting/Outpainting
- ✅ 图像放大

### Midjourney

```typescript
const imageAgent = new ImageAgent({
  imageProvider: 'midjourney',
  imageApiKey: 'mj-...'
});
```

**特性**：
- ✅ 艺术风格生成
- ✅ 高级提示词支持
- ⚠️ 需要 API 访问权限

## 配置选项

### 基础配置

```typescript
interface ImageAgentConfig {
  // Agent 基础配置
  id?: string;
  name?: string;
  description?: string;
  capabilities?: string[];
  
  // LLM 配置（用于任务理解和分析）
  llmClient?: LLMClient;
  llmConfig?: {
    provider: 'openai' | 'anthropic' | 'local';
    apiKey: string;
    model: string;
  };
  
  // 图像服务配置
  imageProvider?: 'openai' | 'replicate' | 'stability' | 'midjourney';
  imageApiKey?: string;
  defaultModel?: string;
  
  // 执行配置
  maxIterations?: number;
  enableReflection?: boolean;
  contextCompression?: {
    enabled: boolean;
    targetTokens?: number;
  };
}
```

### 完整配置示例

```typescript
const imageAgent = new ImageAgent({
  id: 'my-image-agent',
  name: 'Creative Image Agent',
  
  // LLM 配置（用于理解用户意图）
  llmConfig: {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4',
  },
  
  // 图像生成服务
  imageProvider: 'openai',
  imageApiKey: 'sk-...',
  defaultModel: 'dall-e-3',
  
  // 执行参数
  maxIterations: 5,
  enableReflection: true,
  
  // 上下文压缩（处理长对话）
  contextCompression: {
    enabled: true,
    targetTokens: 4000,
  },
});
```

## 使用示例

### 示例 1：生成图像

```typescript
const result = await imageAgent.execute({
  id: 'task-1',
  type: 'image-generation',
  description: '生成一张日落时分的海滩风景，有椰子树和海浪',
  parameters: {
    size: '1792x1024',
    style: 'photographic',
    quality: 'hd'
  }
});

console.log(result.data.imageUrl);
```

### 示例 2：编辑图像

```typescript
const result = await imageAgent.execute({
  id: 'task-2',
  type: 'image-edit',
  description: '将这张图片中的天空改成星空',
  parameters: {
    imageUrl: 'https://example.com/beach.jpg',
    editPrompt: 'Replace the sky with a starry night sky'
  }
});
```

### 示例 3：分析图像

```typescript
const result = await imageAgent.execute({
  id: 'task-3',
  type: 'image-analysis',
  description: '分析这张图片的内容',
  parameters: {
    imageUrl: 'https://example.com/photo.jpg',
    analysisType: 'all'
  }
});

console.log(result.data.analysis);
// {
//   objects: ['person', 'laptop', 'coffee'],
//   scene: 'indoor office',
//   colors: ['#2C3E50', '#ECF0F1'],
//   textDetected: false,
//   faces: 1
// }
```

### 示例 4：移除背景

```typescript
const result = await imageAgent.execute({
  id: 'task-4',
  type: 'background-removal',
  description: '移除产品照片的背景',
  parameters: {
    imageUrl: 'https://example.com/product.jpg',
    format: 'png'
  }
});
```

### 示例 5：图像处理流程

```typescript
// 1. 生成图像
const generated = await imageAgent.execute({
  id: 'step-1',
  type: 'generate',
  description: '生成一个产品 logo',
  parameters: {
    prompt: 'Modern tech company logo, minimalist, blue and white'
  }
});

// 2. 调整大小
const resized = await imageAgent.execute({
  id: 'step-2',
  type: 'resize',
  description: '调整为标准尺寸',
  parameters: {
    imageUrl: generated.data.imageUrl,
    width: 512,
    height: 512,
    maintainAspectRatio: true
  }
});

// 3. 优化文件大小
const optimized = await imageAgent.execute({
  id: 'step-3',
  type: 'optimize',
  description: '优化文件大小',
  parameters: {
    imageUrl: resized.data.imageUrl,
    quality: 85,
    maxFileSize: 100000  // 100KB
  }
});
```

## 事件监听

Image Agent 在执行过程中会触发多个事件：

```typescript
// 监听图像生成开始
imageAgent.on('image:generate-start', (data) => {
  console.log('开始生成图像:', data.prompt);
});

// 监听任务执行
imageAgent.on('task:execute', (task) => {
  console.log('执行任务:', task.description);
});

// 监听工具调用
imageAgent.on('tool:call', (data) => {
  console.log('调用工具:', data.toolName, data.input);
});

// 监听工具结果
imageAgent.on('tool:result', (data) => {
  console.log('工具结果:', data.result);
});

// 监听任务完成
imageAgent.on('task:complete', (result) => {
  console.log('任务完成:', result);
});

// 监听错误
imageAgent.on('task:error', (error) => {
  console.error('任务错误:', error);
});
```

## 能力声明

Image Agent 在初始化时声明以下能力标识：

```typescript
capabilities: [
  'text-to-image',        // 文本生成图像
  'image-to-image',       // 图像转图像
  'image-variation',      // 图像变体
  'image-edit',           // 图像编辑
  'image-inpaint',        // 局部修复
  'image-outpaint',       // 边缘扩展
  'image-upscale',        // 图像放大
  'image-analyze',        // 图像分析
  'image-describe',       // 图像描述
  'image-ocr',            // 文字识别
  'style-transfer',       // 风格转换
  'background-remove',    // 背景移除
]
```

这些能力标识用于：
- Orchestrator 的 Agent 选择
- 能力发现和匹配
- 任务路由决策

## 最佳实践

### 1. 提示词优化

**生成高质量图像的提示词建议**：

```typescript
// ❌ 模糊的提示词
"一张好看的图片"

// ✅ 具体的提示词
"A photorealistic sunset over a tropical beach, with palm trees silhouettes, gentle waves, warm orange and pink sky, golden hour lighting, 4K quality"
```

**提示词结构**：
- 主题（Subject）：图像的主要内容
- 风格（Style）：艺术风格、渲染方式
- 细节（Details）：具体特征、元素
- 光照（Lighting）：光线效果
- 视角（Angle）：拍摄角度
- 质量（Quality）：分辨率、质量描述

### 2. 性能优化

```typescript
// 批量生成时使用异步并发
const tasks = prompts.map(prompt => 
  imageAgent.execute({
    id: `task-${prompt}`,
    type: 'generate',
    description: prompt
  })
);

const results = await Promise.all(tasks);
```

### 3. 错误处理

```typescript
try {
  const result = await imageAgent.execute(task);
  
  if (!result.success) {
    console.error('任务失败:', result.error);
    // 降级处理或重试
  }
} catch (error) {
  console.error('执行异常:', error);
  // 错误恢复逻辑
}
```

### 4. 成本控制

```typescript
// 使用较小的尺寸进行预览
const preview = await imageAgent.execute({
  type: 'generate',
  description: prompt,
  parameters: {
    size: '512x512',
    quality: 'standard'
  }
});

// 用户确认后再生成高清版本
if (userApproved) {
  const final = await imageAgent.execute({
    type: 'generate',
    description: prompt,
    parameters: {
      size: '1792x1024',
      quality: 'hd'
    }
  });
}
```

## 限制与注意事项

### 技术限制

1. **生成质量**：依赖于底层 AI 模型能力
2. **处理时间**：复杂图像生成可能需要 10-30 秒
3. **文件大小**：高分辨率图像可能较大（1-10MB）
4. **API 配额**：注意服务提供商的调用限制

### 内容政策

所有图像服务提供商都有内容政策限制：

- ❌ 暴力、血腥内容
- ❌ 成人内容
- ❌ 仇恨、歧视内容
- ❌ 侵犯版权的内容
- ❌ 误导性深度伪造

### 使用建议

1. **遵守使用条款**：确保使用符合服务提供商的政策
2. **版权意识**：生成的图像可能有使用限制
3. **数据隐私**：避免上传敏感或私密图像
4. **成本监控**：定期检查 API 使用和费用

## 未来规划

### 即将支持的能力

- [ ] 视频生成（text-to-video）
- [ ] 视频编辑（video editing）
- [ ] 3D 模型生成（text-to-3D）
- [ ] 实时图像生成（streaming）
- [ ] 图像到图像的动画（image animation）
- [ ] 高级 AI 修复（advanced inpainting）
- [ ] 智能图像增强（AI enhancement）

### 集成计划

- [ ] 更多图像服务提供商
- [ ] 本地模型支持（Stable Diffusion WebUI）
- [ ] 图像存储服务集成
- [ ] CDN 加速
- [ ] 批量处理优化

## 相关文档

- [BaseAgent 基础文档](../../base/README.md)
- [LLM 客户端文档](../../../llm/README.md)
- [Tool Calling 指南](../../../llm/README.md#tool-calling)
- [Agent 协作指南](../../../../docs/agent-collaboration.md)

## 问题反馈

如有问题或建议，请提交 Issue：
https://github.com/yourusername/monkey-agent/issues
