/**
 * HTML Renderer
 * 
 * 在 iframe 沙箱中渲染纯 HTML 代码（降级方案）
 */

import React, { useEffect, useRef, useState } from 'react';

interface HTMLRendererProps {
  code: string;
  onError?: (error: Error) => void;
}

export const HTMLRenderer: React.FC<HTMLRendererProps> = ({ code, onError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    setIsLoading(true);

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(code);
        iframeDoc.close();

        // 监听加载完成
        iframe.onload = () => {
          setIsLoading(false);
        };

        // 监听错误
        iframe.contentWindow?.addEventListener('error', (event) => {
          console.error('HTML render error:', event.error);
          onError?.(event.error || new Error(event.message));
        });
      }
    } catch (error: any) {
      console.error('Failed to render HTML:', error);
      setIsLoading(false);
      onError?.(error);
    }
  }, [code, onError]);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-500">加载 HTML 中...</div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-scripts"
        title="HTML Preview"
      />
    </div>
  );
};

