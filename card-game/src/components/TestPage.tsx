// v2.2.1.2 — 录制测试页（共享服务端进度版）
//
// 设计：
//   - 81 matchup × 10 局/个 = 810 局
//   - 进度存储在 Node + MySQL 后端，所有用户共享
//   - 5s 轮询拉服务端最新进度
//   - 玩完 1 局立即 POST increment 推送
//   - 10/10 的 matchup 自动锁定（灰显 + 不可点 + 随机跳过）
//   - 旧 localStorage 数据首次访问迁移到服务端
//
// UI 元素：
//   - 顶部全局进度条 (X/810) + 同步状态指示
//   - "下一局推荐"卡片（按 AI BO 胜率推荐 available matchup）
//   - "随机" 按钮（从 available 中随机挑一个）
//   - 81 项 matchup 列表，每项 10 格进度方块
//   - 锁定项灰显 + 不可点
//   - 重置按钮（清空所有 completed）

import { useEffect, useState, useRef } from 'react';
import {
  Play, RotateCcw, RefreshCw, Dices, ArrowLeft, Settings as SettingsIcon,
  Lock, Check, AlertCircle, Loader2,
} from 'lucide-react';
import {
  useTestProgressStore, getNextPending, renderProgressBlocks, type MatchupProgress,
} from '../stores/testProgressStore';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';
import { getCharacterById } from '../game/characters';

const AI_BO_WINRATE: Record<string, number> = {
  char_1: 0.593, char_2: 0.648, char_3: 0.824,
  char_4: 0.843, char_5: 0.556, char_6: 0.944,
  char_7: 0.259, char_8: 0.583, char_9: 0.296,
};

interface TestPageProps {
  onBack: () => void;
  onStartGame: () => void;
  onOpenSettings: () => void;
}

const POLL_INTERVAL_MS = 5_000;
const MIGRATION_LS_KEY = 'card-game-test-progress-migrated';

export function TestPage({ onBack, onStartGame, onOpenSettings }: TestPageProps) {
  const fetchProgress = useTestProgressStore((s) => s.fetchProgress);
  const progress = useTestProgressStore((s) => s.progress);
  const stats = useTestProgressStore((s) => s.stats);
  const isLoading = useTestProgressStore((s) => s.isLoading);
  const error = useTestProgressStore((s) => s.error);
  const lastSyncedAt = useTestProgressStore((s) => s.lastSyncedAt);
  const incrementMatchupAsync = useTestProgressStore((s) => s.incrementMatchupAsync);
  const selectRandomMatchupAsync = useTestProgressStore((s) => s.selectRandomMatchupAsync);
  const resetAllAsync = useTestProgressStore((s) => s.resetAllAsync);
  const migrateFromLocalStorage = useTestProgressStore((s) => s.migrateFromLocalStorage);

  const initGame = useGameStore((s) => s.initGame);
  const setTestMode = useGameStore((s) => s.setTestMode);
  const gameState = useGameStore((s) => s.gameState);

  const autoRecord = useSettingsStore((s) => s.autoRecord);
  const showToast = useToastStore((s) => s.showToast);

  const [secondsSinceSync, setSecondsSinceSync] = useState<number | null>(null);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [showRandomConfirm, setShowRandomConfirm] = useState(false);
  const lastGameOverKeyRef = useRef<string | null>(null);

  // 1. 首次 mount: fetch + 检查是否需要迁移
  useEffect(() => {
    (async () => {
      await fetchProgress();
      // 检查旧 localStorage
      if (typeof localStorage !== 'undefined' && !localStorage.getItem(MIGRATION_LS_KEY)) {
        // 询问用户是否迁移
        if (confirm('检测到旧版本本地测试进度。\n是否合并到服务器共享进度（取最大值）？\n\n点"确定"合并，点"取消"跳过。')) {
          await migrateFromLocalStorage();
          showToast('已合并本地进度到服务器', 'success');
        }
        localStorage.setItem(MIGRATION_LS_KEY, '1');
      }
    })();
  }, []); // 仅 mount

  // 2. 5s 轮询
  useEffect(() => {
    const id = setInterval(() => {
      fetchProgress();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchProgress]);

  // 3. "上次同步 X 秒前" 指示器
  useEffect(() => {
    const id = setInterval(() => {
      if (lastSyncedAt) {
        setSecondsSinceSync(Math.floor((Date.now() - lastSyncedAt) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lastSyncedAt]);

  // 4. 游戏结束监听 → 自动 increment 推送
  useEffect(() => {
    if (gameState.phase !== 'game_over') return;
    if (gameState.players.length === 0) return;
    const human = gameState.players.find(p => p.type === 'human');
    const ai = gameState.players.find(p => p.type === 'ai');
    if (!human || !ai) return;
    const key = `${human.character_id}|${ai.character_id}`;
    if (lastGameOverKeyRef.current === key) return; // 同 matchup 不重复 increment
    lastGameOverKeyRef.current = key;

    // 推送服务端
    (async () => {
      const result = await incrementMatchupAsync(human.character_id, ai.character_id);
      if (result.ok) {
        const newStatus = result.data.status;
        if (newStatus === 'locked') {
          showToast(`✅ ${key} 已收集满 10 局，matchup 已锁定！`, 'success');
        } else {
          showToast(`✅ 进度更新: ${key} ${result.data.completed}/${result.data.target}`, 'success');
        }
      } else if (result.code === 'LOCKED') {
        showToast(`⚠️ ${key} 已被其他玩家锁定（${result.error}）`, 'info');
      } else {
        showToast(`同步失败: ${result.error}`, 'error');
      }
    })();
  }, [gameState.phase, gameState.players]);

  // ============ UI 工具 ============

  const nextPending = getNextPending(progress, AI_BO_WINRATE);
  const progressPercent = stats.target > 0 ? (stats.completed / stats.target) * 100 : 0;

  const handleStart = (m: MatchupProgress) => {
    if (m.status === 'locked') return;
    if (!autoRecord) {
      if (!confirm('自动录制未开启。是否仍要开始游戏？')) return;
    }
    setTestMode(true);
    initGame(m.humanChar, [m.aiChar], '1v1');
    showToast(`已加载对局: ${m.humanChar} vs ${m.aiChar}`, 'info');
    onStartGame();
  };

  const handleStartNext = () => {
    if (!nextPending) {
      showToast('所有 matchup 已收集满 10 局！', 'success');
      return;
    }
    handleStart(nextPending);
  };

  const handleRandom = async () => {
    const m = await selectRandomMatchupAsync();
    if (!m) {
      showToast('所有 matchup 已收集满 10 局！', 'success');
      return;
    }
    handleStart(m);
  };

  const handleReset = async () => {
    if (!confirm('清空所有 81 个 matchup 的已完成局数（保留 target=10）？\n此操作会影响所有登录此网站的玩家，不可撤销。')) {
      return;
    }
    const ok = await resetAllAsync();
    if (ok) {
      showToast('已重置所有进度', 'info');
    } else {
      showToast('重置失败', 'error');
    }
  };

  const handleRefresh = async () => {
    await fetchProgress();
  };

  // 排序：按 AI BO 胜率降序，同 BO 胜率按人类角色顺序
  const sortedProgress = Object.values(progress).sort((a, b) => {
    const wa = AI_BO_WINRATE[a.aiChar] ?? 0;
    const wb = AI_BO_WINRATE[b.aiChar] ?? 0;
    if (wa !== wb) return wb - wa;
    return a.humanChar.localeCompare(b.humanChar);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-6">
          <button
            data-testid="test-back"
            onClick={onBack}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />返回封面
          </button>
          <h1 className="text-2xl font-bold text-white">📋 录制测试模式</h1>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
            title="设置"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 全局进度 */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white">📊 整体进度</h2>
            <span className="text-2xl font-bold text-indigo-400">
              {stats.completed} / {stats.target}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
            <div
              className="bg-indigo-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>
              <span>已锁定 <strong className="text-green-400">{stats.locked}</strong> / 81 · </span>
              <span>剩余 <strong className="text-amber-400">{stats.remaining}</strong> 局</span>
            </div>
            <div className="flex items-center gap-2" data-testid="sync-indicator">
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : error ? (
                <AlertCircle className="w-3 h-3 text-red-400" />
              ) : (
                <Check className="w-3 h-3 text-green-400" />
              )}
              <span>
                {error
                  ? `错误: ${error}`
                  : secondsSinceSync !== null
                    ? `上次同步 ${secondsSinceSync}s 前`
                    : '同步中...'}
              </span>
              <button
                data-testid="test-refresh"
                onClick={handleRefresh}
                className="ml-2 p-1 hover:bg-slate-700 rounded transition-colors"
                title="手动刷新"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 下一局卡片 + 随机 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {nextPending ? (
            <div
              data-testid="next-pending-card"
              className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-xl p-5 border border-indigo-500/30"
            >
              <h3 className="text-sm font-semibold text-indigo-300 mb-2">🎯 下一局（推荐）</h3>
              <div className="text-2xl font-bold text-white mb-3">
                {getCharacterById(nextPending.humanChar)?.name || nextPending.humanChar}
                <span className="text-slate-400 mx-2 text-base font-normal">vs</span>
                {getCharacterById(nextPending.aiChar)?.name || nextPending.aiChar}
              </div>
              <div className="text-xs text-slate-400 mb-3">
                AI BO 胜率 {(AI_BO_WINRATE[nextPending.aiChar] * 100).toFixed(1)}% · 进度 {nextPending.completed}/{nextPending.target}
              </div>
              <button
                data-testid="test-start-next"
                onClick={handleStartNext}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-lg shadow-indigo-600/30 transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />开始游戏
              </button>
            </div>
          ) : (
            <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-5 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <div className="text-lg font-semibold text-green-300">所有 matchup 已收集满 10 局！</div>
            </div>
          )}

          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 flex flex-col justify-center">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">🎲 随机选择</h3>
            <div className="text-xs text-slate-400 mb-3">
              从 <strong className="text-amber-400">{stats.available}</strong> 个未收满的 matchup 中随机挑一个
            </div>
            <button
              data-testid="test-random"
              onClick={handleRandom}
              disabled={stats.available === 0}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg shadow-lg shadow-amber-600/30 transition-colors flex items-center justify-center gap-2"
            >
              <Dices className="w-5 h-5" />随机一局
            </button>
          </div>
        </div>

        {/* matchup 清单 */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">📋 Matchup 清单 (81 项 × 10 局 = 810 局)</h3>
            <button
              onClick={handleReset}
              data-testid="test-reset"
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />重置全部进度
            </button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 sticky top-0">
                <tr className="text-xs text-slate-400">
                  <th className="text-left px-4 py-2">人类</th>
                  <th className="text-left px-4 py-2">AI</th>
                  <th className="text-left px-4 py-2">AI 胜率</th>
                  <th className="text-left px-4 py-2">进度 (10 格)</th>
                  <th className="text-left px-4 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedProgress.map((m) => {
                  const locked = m.status === 'locked';
                  return (
                    <tr
                      key={m.matchupKey}
                      data-testid={`matchup-row-${m.matchupKey}`}
                      data-status={m.status}
                      className={`border-t border-slate-700/50 ${locked ? 'bg-green-900/10 opacity-60' : ''}`}
                    >
                      <td className="px-4 py-2 text-slate-200">
                        {getCharacterById(m.humanChar)?.name || m.humanChar}
                      </td>
                      <td className="px-4 py-2 text-slate-200">
                        {getCharacterById(m.aiChar)?.name || m.aiChar}
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs">
                        {(AI_BO_WINRATE[m.aiChar] * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-sm tracking-tighter ${
                              locked ? 'text-green-400' : m.completed > 0 ? 'text-amber-300' : 'text-slate-500'
                            }`}
                            title={`${m.completed}/${m.target}`}
                          >
                            {renderProgressBlocks(m.completed, m.target)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {m.completed}/{m.target}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {locked ? (
                          <span
                            data-testid={`matchup-locked-${m.matchupKey}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-400"
                          >
                            <Lock className="w-3 h-3" />已锁定
                          </span>
                        ) : (
                          <button
                            onClick={() => handleStart(m)}
                            data-testid={`matchup-play-${m.matchupKey}`}
                            className="px-2 py-1 bg-indigo-600/50 hover:bg-indigo-600 text-white text-xs rounded transition-colors flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />玩
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-500 italic mt-4 text-center">
          提示：所有登录此网站的玩家共用此进度。每 5s 自动同步。已收满 10 局的 matchup 自动锁定。
        </p>
      </div>
    </div>
  );
}
