/**
 * Artifact Viewer
 * 
 * Artifact 查看器主组件
 */

import React, { useState } from 'react';
import { Tabs, Button, message as antdMessage } from 'antd';
import { DownloadOutlined, CopyOutlined, FullscreenOutlined } from '@ant-design/icons';
import { ReactRenderer } from './ReactRenderer';
import { HTMLRenderer } from './HTMLRenderer';
import { CodeEditor } from './CodeEditor';
import { useArtifactStore } from '../../stores/artifactStore';
import type { Artifact } from '../../types';

interface ArtifactViewerProps {
  artifact: Artifact;
  onCompileError?: (artifactId: string, error: string) => void;
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifact, onCompileError }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [localCode, setLocalCode] = useState(artifact.code);
  const updateArtifact = useArtifactStore((state) => state.updateArtifact);

  const handleCodeChange = (newCode: string) => {
    setLocalCode(newCode);
    // 延迟更新以避免频繁渲染
    setTimeout(() => {
      updateArtifact(artifact.id, newCode);
    }, 500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(localCode);
    antdMessage.success('代码已复制到剪贴板');
  };

  const handleDownload = () => {
    const blob = new Blob([localCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const extension = artifact.type === 'html' ? 'html' : 'jsx';
    a.download = `${artifact.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    antdMessage.success('文件已下载');
  };

  const handleFullscreen = () => {
    // TODO: 实现全屏功能
    antdMessage.info('全屏功能开发中');
  };

  const items = [
    {
      key: 'preview',
      label: '预览',
      children: (
        <div className="h-full">
          {artifact.type === 'html' ? (
            <HTMLRenderer
              code={localCode}
              onError={(error) => {
                antdMessage.error(`渲染错误: ${error.message}`);
              }}
            />
          ) : (
            <ReactRenderer
              code={localCode}
              artifactId={artifact.id}
              onError={(error) => {
                antdMessage.error(`渲染错误: ${error.message}`);
              }}
              onCompileError={onCompileError}
            />
          )}
        </div>
      ),
    },
    {
      key: 'code',
      label: '代码',
      children: (
        <div className="h-full">
          <CodeEditor
            value={localCode}
            onChange={handleCodeChange}
            language="jsx"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{artifact.title}</h3>
          {artifact.description && (
            <p className="text-sm text-gray-600">{artifact.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopyCode}
            size="small"
          >
            复制
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            size="small"
          >
            下载
          </Button>
          <Button
            icon={<FullscreenOutlined />}
            onClick={handleFullscreen}
            size="small"
          >
            全屏
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'preview' | 'code')}
          items={items}
          className="h-full"
          style={{ height: '100%' }}
          tabBarStyle={{ margin: 0, paddingLeft: 16 }}
        />
      </div>
    </div>
  );
};

