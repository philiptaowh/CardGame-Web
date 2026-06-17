// 录制 Tab — 自动录制开关 + 录制状态 + 已保存回放列表
//
// P1.5 业务逻辑：
//   1. settingsStore.autoRecord 控制是否自动开始录制
//      - 关闭（默认）：每局 1v1 不会自动录制
//      - 开启：每局 1v1 initGame 时自动开始录制
//   2. 游戏中显示录制状态（recording / currentReplay 待保存）
//   3. 游戏结束后，胜利弹窗要求用户显式点击"保存录像"或"丢弃"
//   4. 已保存的回放写入 localStorage，可从列表下载
//
// 仅支持 1v1 模式；1vN / LAN 模式录制功能开发中

import { useEffect, useState } from 'react';
import { Circle, Download, Trash2, Power, FolderOpen, Folder } from 'lucide-react';
import { useReplayStore, type V1Replay } from '../../stores/replayStore';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import { exportReplayAsJSONL, generateReplayFilename } from '../../services/replayExporter';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toTimeString().slice(0, 8)}`;
}

function ReplayRow({ replay, onDownload, onDelete }: {
  replay: V1Replay;
  onDownload: (r: V1Replay) => void;
  onDelete: (r: V1Replay) => void;
}) {
  return (
    <li className="flex items-center justify-between text-sm bg-slate-800/50 rounded px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-slate-200 truncate">{generateReplayFilename(replay)}</div>
        <div className="text-xs text-slate-500">
          {replay.moves.length} 动作 · {replay.winner ? `${replay.winner} 胜` : '平局'} ·
          {' '}{formatTimestamp(replay.timestamp)}
        </div>
      </div>
      <div className="flex gap-1 ml-2">
        <button
          data-testid={`replay-download-${replay.timestamp}`}
          onClick={() => onDownload(replay)}
          className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
          title="导出"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(replay)}
          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

export function RecordingTab() {
  const isRecording = useReplayStore((s) => s.isRecording);
  const currentReplay = useReplayStore((s) => s.currentReplay);
  const savedReplays = useReplayStore((s) => s.savedReplays);
  const saveCurrentReplay = useReplayStore((s) => s.saveCurrentReplay);
  const discardCurrentReplay = useReplayStore((s) => s.discardCurrentReplay);
  const clearSavedReplays = useReplayStore((s) => s.clearSavedReplays);
  const removeSavedReplay = useReplayStore((s) => s.removeSavedReplay);

  const gameState = useGameStore((s) => s.gameState);

  const autoRecord = useSettingsStore((s) => s.autoRecord);
  const setAutoRecord = useSettingsStore((s) => s.setAutoRecord);

  const showToast = useToastStore((s) => s.showToast);

  // 录制中每 500ms 更新一次动作计数
  const [moveCount, setMoveCount] = useState(0);
  useEffect(() => {
    if (!isRecording) {
      setMoveCount(0);
      return;
    }
    const timer = setInterval(() => {
      setMoveCount(useReplayStore.getState().currentReplay?.moves.length ?? 0);
    }, 500);
    return () => clearInterval(timer);
  }, [isRecording]);

  // v1.3.0: 在 Electron 模式下显示 replays/ 绝对路径，让玩家知道数据存哪
  const [replaysDir, setReplaysDir] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.getReplaysDir) return;
    window.electronAPI.getReplaysDir()
      .then(setReplaysDir)
      .catch((err) => console.warn('[RecordingTab] getReplaysDir 失败:', err));
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

  const isGameInProgress = gameState.phase !== 'game_over' && gameState.players.length > 0;
  const is1v1 = gameState.gameMode === '1v1';

  // 处理"立即保存"（用于游戏仍在进行但用户想保存当前录制）
  const handleSaveCurrent = async () => {
    const finalized = saveCurrentReplay();
    if (finalized) {
      const result = await exportReplayAsJSONL(finalized);
      if (result.ok) {
        const dest = result.path ?? '(浏览器下载)';
        showToast(`已保存 ${finalized.moves.length} 个动作 → ${dest}`, 'success');
      } else {
        showToast(`保存失败: ${result.error ?? '未知错误'}`, 'error');
      }
    }
  };

  const handleDiscardCurrent = () => {
    if (confirm('确定丢弃当前录制？此操作不可撤销。')) {
      discardCurrentReplay();
      showToast('已丢弃当前录制', 'info');
    }
  };

  const handleExportSaved = async (r: V1Replay) => {
    const result = await exportReplayAsJSONL(r);
    if (result.ok) {
      const dest = result.path ?? '(浏览器下载)';
      showToast(`已下载 → ${dest}`, 'success');
    } else {
      showToast(`下载失败: ${result.error ?? '未知错误'}`, 'error');
    }
  };

  const handleDeleteSaved = (r: V1Replay) => {
    if (confirm(`确定删除 ${generateReplayFilename(r)} ?`)) {
      const idx = useReplayStore.getState().savedReplays.indexOf(r);
      if (idx >= 0) removeSavedReplay(idx);
    }
  };

  return (
    <div className="space-y-4">
      {/* v1.3.0 测试版：数据输出位置（仅 Electron 显示） */}
      {replaysDir && (
        <section>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">📂 数据输出位置</h3>
          <div className="p-3 rounded border border-slate-700 bg-slate-800/30 space-y-2">
            <div className="text-xs text-slate-400">
              所有录像 JSONL 和测试进度都会写到下面这个文件夹。测完对局后，
              请把整个 <code className="px-1 py-0.5 bg-slate-900/60 rounded text-indigo-300">replays/</code>{' '}
              文件夹打包发回给开发者。
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 break-all bg-slate-900/60 rounded px-2 py-1.5">
              <Folder className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="flex-1 min-w-0">{replaysDir}</span>
            </div>
            <button
              data-testid="open-replays-dir"
              onClick={handleOpenReplaysDir}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />用资源管理器打开
            </button>
          </div>
        </section>
      )}

      {/* 自动录制开关 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">自动录制</h3>
        <label className="flex items-start gap-3 p-3 rounded border border-slate-700 bg-slate-800/30 cursor-pointer">
          <input
            type="checkbox"
            data-testid="auto-record-toggle"
            checked={autoRecord}
            onChange={(e) => setAutoRecord(e.target.checked)}
            className="mt-1 w-4 h-4"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
              <Power className="w-3.5 h-3.5" />
              启用自动录制
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              开启后，每局 1v1 游戏开始时会自动录制，并在胜利弹窗要求您选择保存或丢弃。
            </div>
          </div>
        </label>
      </section>

      {/* 录制状态 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">录制状态</h3>
        {isRecording ? (
          <div className="flex items-center gap-2 text-red-400" data-testid="recording-status-active">
            <Circle className="w-3 h-3 fill-current animate-pulse" />
            <span>录制中（已记录 {moveCount} 个动作）</span>
          </div>
        ) : currentReplay ? (
          <div className="space-y-2">
            <div className="text-amber-400" data-testid="recording-status-pending">
              ⏳ 待保存（{currentReplay.moves.length} 个动作，胜利弹窗中保存或丢弃）
            </div>
            <div className="flex gap-2">
              <button
                data-testid="recording-save-now"
                onClick={handleSaveCurrent}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />立即保存并下载
              </button>
              <button
                data-testid="recording-discard-now"
                onClick={handleDiscardCurrent}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />丢弃
              </button>
            </div>
          </div>
        ) : (
          <div className="text-slate-400" data-testid="recording-status-idle">
            {autoRecord ? '🟢 自动录制已开启，等待游戏开始' : '⚫ 自动录制已关闭'}
          </div>
        )}
        {!is1v1 && isGameInProgress && (
          <p className="text-xs text-amber-400 mt-1">
            ⚠ 当前为多人模式（{gameState.gameMode}），录制功能仅支持 1v1
          </p>
        )}
      </section>

      {/* 已保存回放 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">
            已保存的回放（{savedReplays.length}）
          </h3>
          {savedReplays.length > 0 && (
            <button
              onClick={() => {
                if (confirm('清空所有已保存的回放？')) clearSavedReplays();
              }}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              清空全部
            </button>
          )}
        </div>
        {savedReplays.length === 0 ? (
          <p className="text-slate-500 text-sm">暂无（录制数据自动保存到 localStorage，关闭浏览器后仍可恢复）</p>
        ) : (
          <ul className="space-y-1" data-testid="saved-replays-list">
            {savedReplays.map((r) => (
              <ReplayRow
                key={r.timestamp}
                replay={r}
                onDownload={handleExportSaved}
                onDelete={handleDeleteSaved}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500 italic">
        注：当前版本仅支持 1v1 模式录制。1vN 与局域网模式录制功能开发中。
      </p>
    </div>
  );
}
