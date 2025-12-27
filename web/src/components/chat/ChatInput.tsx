import React, { useState, useRef, useEffect } from 'react';
import { Input, Button } from 'antd';
import { SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import './ChatInput.css';

const { TextArea } = Input;

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textAreaRef = useRef<any>(null);

  const handleSend = () => {
    if (value.trim()) {
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 自动聚焦
  useEffect(() => {
    if (textAreaRef.current && !disabled) {
      textAreaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="chat-input-wrapper">
      <div className={`chat-input-container ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}>
        {/* 渐变边框效果 */}
        <div className="gradient-border"></div>
        
        {/* 输入区域 */}
        <div className="input-content">
          <TextArea
            ref={textAreaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="输入你的问题或任务... (Enter 发送, Shift+Enter 换行)"
            autoSize={{ minRows: 1, maxRows: 6 }}
            disabled={disabled}
            className="chat-textarea"
            bordered={false}
          />
          
          {/* 操作按钮区 */}
          <div className="input-actions">
            {value.trim() && !disabled && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                className="send-button"
                size="large"
              >
                发送
              </Button>
            )}
            {!value.trim() && (
              <div className="input-hint">
                <ThunderboltOutlined /> 试试问我任何问题
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 底部提示 */}
      <div className="input-footer">
        <span className="footer-hint">
          Monkey Agent 可能会出错，请核对重要信息
        </span>
      </div>
    </div>
  );
};

