/**
 * Code Editor
 * 
 * 代码编辑器组件（简化版，使用 textarea）
 * TODO: 安装 @monaco-editor/react 后升级
 */

import React, { useState, useEffect } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'javascript' | 'typescript' | 'jsx';
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'jsx',
}) => {
  const [code, setCode] = useState(value);

  useEffect(() => {
    setCode(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    onChange(newCode);
  };

  return (
    <div className="relative w-full h-full">
      <textarea
        value={code}
        onChange={handleChange}
        className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 border-none resize-none focus:outline-none"
        style={{
          tabSize: 2,
          lineHeight: '1.5',
        }}
        spellCheck={false}
        placeholder="// 在此编辑代码..."
      />
      <div className="absolute top-2 right-2 text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
        {language.toUpperCase()}
      </div>
    </div>
  );
};

