/**
 * React Renderer
 * 
 * 在 iframe 沙箱中渲染 React 代码，支持增量编译
 */

import React, { useEffect, useRef, useState } from 'react';

interface ReactRendererProps {
  code: string;
  artifactId: string;  // 新增：用于标识 artifact
  onError?: (error: Error) => void;
  onCompileError?: (artifactId: string, error: string) => void;  // 新增：编译错误回调
}

export const ReactRenderer: React.FC<ReactRendererProps> = ({ 
  code, 
  artifactId,
  onError,
  onCompileError 
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastValidCode, setLastValidCode] = useState('');
  const [compileAttempts, setCompileAttempts] = useState(0);
  const [lastError, setLastError] = useState<string>('');
  const [hasNotifiedError, setHasNotifiedError] = useState(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // 检查代码是否可能完整
    if (!isCodeLikelyComplete(code)) {
      // 代码还不完整，继续等待
      return;
    }

    setIsLoading(true);

    try {
      // 创建完整的 HTML 文档
      const htmlContent = generateHTMLDocument(code);

      // 写入 iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // 监听加载完成
        iframe.onload = () => {
          setIsLoading(false);
          // 编译成功，重置错误状态
          setCompileAttempts(0);
          setLastError('');
          setHasNotifiedError(false);
          setLastValidCode(code);
        };

        // 监听错误
        iframe.contentWindow?.addEventListener('error', (event) => {
          console.error('Iframe runtime error:', event.error);
          const errorMsg = event.error?.message || event.message || '未知渲染错误';
          
          setLastError(errorMsg);
          setCompileAttempts(prev => prev + 1);
          
          // 第二次失败后通知后端
          if (compileAttempts >= 1 && !hasNotifiedError && onCompileError) {
            setHasNotifiedError(true);
            onCompileError(artifactId, errorMsg);
          }
          
          onError?.(event.error || new Error(errorMsg));
          
          // 如果有上一次成功的代码，尝试回退显示
          if (lastValidCode && lastValidCode !== code) {
            console.log('尝试回退到上一次成功的代码');
            // 这里可以选择回退或继续显示错误
          }
        });
      }
    } catch (error: any) {
      const errorMsg = error.message || '代码编译失败';
      console.error('编译错误:', error);
      
      setLastError(errorMsg);
      setCompileAttempts(prev => prev + 1);
      setIsLoading(false);
      
      // 第二次失败后通知后端
      if (compileAttempts >= 1 && !hasNotifiedError && onCompileError) {
        setHasNotifiedError(true);
        onCompileError(artifactId, errorMsg);
      }
      
      onError?.(error);
    }
  }, [code, artifactId, compileAttempts, hasNotifiedError, lastValidCode, onError, onCompileError]);

  return (
    <div className="relative w-full h-full">
      {lastError && !isLoading && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-sm text-yellow-800 z-10">
          ⚠️ React 代码编译失败，正在生成 HTML 版本...
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-500">加载中...</div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-scripts"
        title="React Preview"
      />
    </div>
  );
};

/**
 * 检查代码是否可能完整
 */
function isCodeLikelyComplete(code: string): boolean {
  // 检查基本的代码结构标记
  const hasImports = code.includes('import React');
  const hasRootRender = code.includes('root.render');
  const hasFunctionDefinition = /function \w+\s*\(/.test(code) || /const \w+\s*=\s*\(/.test(code);
  
  // 简单的括号平衡检查
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  const bracesBalanced = openBraces > 0 && openBraces === closeBraces;
  
  return hasImports && hasRootRender && hasFunctionDefinition && bracesBalanced;
}

/**
 * 生成完整的 HTML 文档
 */
function generateHTMLDocument(code: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Preview</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- React & ReactDOM (UMD) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  
  <!-- Recharts (UMD) -->
  <script src="https://unpkg.com/recharts@2/dist/Recharts.js"></script>
  
  <!-- React Markdown -->
  <script src="https://unpkg.com/react-markdown@9/react-markdown.min.js"></script>
  
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    * {
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script type="text/babel">
    // 全局 React 变量
    const { useState, useMemo, useEffect } = React;
    const { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = Recharts;
    
    // 用户代码
    ${code}
  </script>
  
  <!-- Babel Standalone for JSX transformation -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <script>
    // 错误处理
    window.onerror = function(message, source, lineno, colno, error) {
      console.error('Runtime error:', { message, source, lineno, colno, error });
      document.getElementById('root').innerHTML = 
        '<div style="padding: 20px; color: red; background: #fee;">'+
        '<h2>渲染错误</h2>'+
        '<p>' + message + '</p>'+
        '<p>Line: ' + lineno + ', Column: ' + colno + '</p>'+
        '</div>';
      return true;
    };
  </script>
</body>
</html>
  `.trim();
}

