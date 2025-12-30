import React from 'react';
import { Typography, Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { IntentRecognitionCard } from './IntentRecognitionCard';

const { Paragraph } = Typography;

// 复制到剪贴板
const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    message.success(`${label}已复制到剪贴板`);
  } catch (err) {
    message.error('复制失败');
  }
};

// 格式化工具输入参数 - 显示完整原始数据
export const formatToolInput = (input: any) => {
  // 不再格式化省略，直接返回原始 input
  return input;
};

// 格式化工具结果 - 显示完整原始数据，默认展示 3 行
export const formatToolResult = (result: any) => {
  const resultStr = typeof result === 'string' 
    ? result 
    : JSON.stringify(result, null, 2);
    
  // 不再截断，直接返回完整结果
  return { preview: resultStr, full: resultStr, truncated: false };
};

interface EventDetailFormatterProps {
  eventType: string;
  data: any;
}

export const EventDetailFormatter: React.FC<EventDetailFormatterProps> = ({ eventType, data }) => {
  if (!data) return null;

  // 意图识别结果：使用专门的卡片组件
  if (eventType === 'agent:tool-result' && data.toolName === 'recognizeIntent' && data.result) {
    return <IntentRecognitionCard result={data.result} />;
  }

  // 反思事件：显示反思内容
  if (eventType === 'agent:reflection' && data.reflection) {
    return (
      <Paragraph
        style={{
          fontSize: 12,
          marginTop: 8,
          marginBottom: 0,
          marginLeft: 20,
          padding: 12,
          background: '#f9f0ff',
          border: '1px solid #d3adf7',
          borderRadius: 4,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6
        }}
        ellipsis={{ rows: 4, expandable: true, symbol: '展开完整反思' }}
      >
        {typeof data.reflection === 'string' ? data.reflection : JSON.stringify(data.reflection, null, 2)}
      </Paragraph>
    );
  }

  // 工具调用事件：显示格式化的输入参数
  if (eventType === 'agent:tool-call' && data.input) {
    const formattedInput = formatToolInput(data.input);
    const inputText = JSON.stringify(formattedInput, null, 2);
    return (
      <div style={{ position: 'relative' }}>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard(inputText, '工具输入')}
          style={{
            position: 'absolute',
            right: 4,
            top: 4,
            zIndex: 1,
            fontSize: 10,
            padding: '0 4px',
            height: 20
          }}
        >
          复制
        </Button>
        <Paragraph
          style={{
            fontSize: 11,
            marginTop: 4,
            marginBottom: 0,
            marginLeft: 20,
            padding: 6,
            background: 'var(--ant-color-fill-quaternary)',
            borderRadius: 4,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap'
          }}
          ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
        >
          {inputText}
        </Paragraph>
      </div>
    );
  }

  // 工具结果事件：显示格式化的结果
  if (eventType === 'agent:tool-result' && data.result) {
    const formatted = formatToolResult(data.result);
    return (
      <div style={{ position: 'relative' }}>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard(formatted.full, '工具结果')}
          style={{
            position: 'absolute',
            right: 4,
            top: 4,
            zIndex: 1,
            fontSize: 10,
            padding: '0 4px',
            height: 20
          }}
        >
          复制
        </Button>
        <Paragraph
          style={{
            fontSize: 11,
            marginTop: 4,
            marginBottom: 0,
            marginLeft: 20,
            padding: 6,
            background: 'var(--ant-color-fill-quaternary)',
            borderRadius: 4,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap'
          }}
          ellipsis={{ rows: formatted.truncated ? 3 : undefined, expandable: true, symbol: '查看完整内容' }}
        >
          {formatted.preview}
        </Paragraph>
      </div>
    );
  }

  // 其他事件：显示原始数据
  if (data.input || data.result) {
    return (
      <Paragraph
        style={{
          fontSize: 11,
          marginTop: 4,
          marginBottom: 0,
          marginLeft: 20,
          padding: 6,
          background: 'var(--ant-color-fill-quaternary)',
          borderRadius: 4,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap'
        }}
        ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
      >
        {JSON.stringify(data.input || data.result, null, 2)}
      </Paragraph>
    );
  }

  return null;
};

