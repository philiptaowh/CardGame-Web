// 设置弹窗 — 容器 + Tab 路由 + 关闭逻辑
//
// Tab 内容由子组件（settings/*）提供
// 关闭：ESC / 外点 / × 按钮

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useSettingsStore, type SettingsTab } from '../stores/settingsStore';
import { RecordingTab } from './settings/RecordingTab';
import { AiLevelTab } from './settings/AiLevelTab';
import { AboutTab } from './settings/AboutTab';

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'recording', label: '录制' },
  { id: 'aiLevel', label: 'AI 难度' },
  { id: 'about', label: '关于' },
];

export function SettingsModal() {
  const isOpen = useSettingsStore((s) => s.isOpen);
  const activeTab = useSettingsStore((s) => s.activeTab);
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const close = useSettingsStore((s) => s.close);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={close}
    >
      <div
        data-testid="settings-modal-card"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">⚙ 设置</h2>
          <button
            data-testid="settings-close"
            onClick={close}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 导航 */}
        <div className="flex border-b border-slate-700 px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`settings-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'recording' && <RecordingTab />}
          {activeTab === 'aiLevel' && <AiLevelTab />}
          {activeTab === 'about' && <AboutTab />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 flex justify-end">
          <button
            onClick={close}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
