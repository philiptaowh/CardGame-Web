// 设置按钮 — 齿轮图标，点击打开设置弹窗
//
// 放置位置：主界面右上角（由 App.tsx 挂载）
// 弹窗内容由 SettingsModal 提供

import { Settings } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';

export function SettingsButton() {
  const open = useSettingsStore((s) => s.open);

  return (
    <button
      data-testid="settings-button"
      onClick={() => open('recording')}
      className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
      title="设置"
    >
      <Settings className="w-5 h-5" />
    </button>
  );
}
