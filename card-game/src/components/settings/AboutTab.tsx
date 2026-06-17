// 关于 Tab — 版本信息 + 文档链接 + 数据输出位置
//
// Phase 1 仅展示基础信息，后续 Phase 可加入 changelog

import { useEffect, useState } from 'react';
import { BookOpen, Code2, FolderOpen, Folder } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';

export function AboutTab() {
  const [replaysDir, setReplaysDir] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.getReplaysDir) return;
    window.electronAPI.getReplaysDir()
      .then(setReplaysDir)
      .catch((err) => console.warn('[AboutTab] getReplaysDir 失败:', err));
  }, []);

  const handleOpenReplaysDir = async () => {
    if (!window.electronAPI?.openReplaysDir) {
      showToast('当前环境不支持该操作', 'error');
      return;
    }
    try {
      await window.electronAPI.openReplaysDir();
    } catch (err) {
      showToast(`打开文件夹失败: ${(err as Error)?.message ?? String(err)}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">关于本游戏</h3>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">版本</dt>
            <dd className="text-slate-200 font-mono">v1.3.0-test</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">类型</dt>
            <dd className="text-slate-200">回合制卡牌对战</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">角色数</dt>
            <dd className="text-slate-200">9</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">特殊卡数</dt>
            <dd className="text-slate-200">16</dd>
          </div>
        </dl>
      </section>

      {/* v1.3.0 测试版：数据输出位置（仅 Electron 显示） */}
      {replaysDir && (
        <section>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">📂 数据输出位置</h3>
          <div className="p-3 rounded border border-slate-700 bg-slate-800/30 space-y-2">
            <div className="text-xs text-slate-400">
              录像和测试进度保存位置（NSIS 安装目录下）。测完后打包此文件夹回传给开发者。
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 break-all bg-slate-900/60 rounded px-2 py-1.5">
              <Folder className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="flex-1 min-w-0">{replaysDir}</span>
            </div>
            <button
              data-testid="about-open-replays-dir"
              onClick={handleOpenReplaysDir}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />用资源管理器打开
            </button>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">文档链接</h3>
        <div className="space-y-1.5">
          <a
            href="docs/卡牌游戏2.0原型.md"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-indigo-400 transition-colors"
          >
            <BookOpen className="w-4 h-4" />项目设计文档（docs/）
          </a>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-indigo-400 transition-colors"
          >
            <Code2 className="w-4 h-4" />GitHub 仓库
          </a>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">AI 智能水平强化进度</h3>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>✅ v2.0.0 仿真引擎 + 规则 AI 基线</li>
          <li>✅ v2.1.0 Meta 分析 + 角色梯度</li>
          <li>✅ v2.1.1 BO 超参优化（9 角色全完成）</li>
          <li>📅 v1.3.0-test 数据采集（玩家人机对局 → JSONL）</li>
        </ul>
      </section>
    </div>
  );
}
