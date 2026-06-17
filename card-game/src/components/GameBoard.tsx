// 游戏桌面布局 - 沉浸式桌游体验

import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import { useReplayStore } from '../stores/replayStore';
import { useToastStore } from '../stores/toastStore';
import { exportReplayAsJSONL, uploadReplayToServer, flushPendingUploads } from '../services/replayExporter';
import { isWebMode } from '../config/buildMode';
import { PlayerArea } from './PlayerArea';
import { PhaseIndicator } from './PhaseIndicator';
import { GameLog } from './GameLog';
import { EnergySelectModal } from './EnergySelectModal';
import { CardExchangeModal } from './CardExchangeModal';
import { EnergyResultModal } from './EnergyResultModal';
import { EnemyCard } from './EnemyCard';
import { AIController } from './AIController';
import { Layers, Trash2, LogOut, Power, HelpCircle, X, Swords, BookOpen, User, Info, Clock, ArrowLeft, Save, Loader2, CloudUpload } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAllCharacters } from '../game/characters';
import { getSpecialCards } from '../game/cards';
import { getAllMarks } from '../game/marks';

export function GameBoard({ onBack }: { onBack?: () => void }) {
  const gameState = useGameStore(state => state.gameState);
  const advancePhase = useGameStore(state => state.advancePhase);
  const endTurn = useGameStore(state => state.endTurn);
  const isTestMode = useGameStore((s) => s.isTestMode);
  const { mode: lanMode, playerId: localPlayerId, lanTimeBank } = useNetworkStore();
  const isLAN = lanMode === 'lan';
  const webMode = isWebMode();

  // P1.5: 录制相关
  const currentReplay = useReplayStore((s) => s.currentReplay);
  const saveCurrentReplay = useReplayStore((s) => s.saveCurrentReplay);
  const discardCurrentReplay = useReplayStore((s) => s.discardCurrentReplay);
  const enqueuePending = useReplayStore((s) => s.enqueuePending);
  const markUploaded = useReplayStore((s) => s.markUploaded);
  const pendingUploads = useReplayStore((s) => s.pendingUploads);
  const showToast = useToastStore((s) => s.showToast);
  const [isSavingReplay, setIsSavingReplay] = useState(false);

  // v2.2.1.2: 测试进度增量已迁移到 TestPage 监听 gameState.phase === 'game_over' 自动推送
  // 不再在 GameBoard 的 handleSaveReplay 中重复 increment, 防止双重计数

  const [isQuitting, setIsQuitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState<'rules' | 'chars' | 'cards' | 'marks'>('rules');

  const { players, turn, phase, current_player_index, deck, discard_pile } = gameState;

  // v2.2.0-alpha: 进入 GameBoard 时如有待上传录像，自动补传
  useEffect(() => {
    if (!webMode) return;
    if (pendingUploads.length === 0) return;
    let cancelled = false;
    (async () => {
      const result = await flushPendingUploads(pendingUploads, (done, total) => {
        if (!cancelled) showToast(`补传录像中 (${done}/${total})...`, 'info');
      });
      if (cancelled) return;
      // 成功上传的逐个出队（按 upload 成功数）
      for (let i = 0; i < result.success; i++) {
        const next = useReplayStore.getState().peekPending();
        if (next) useReplayStore.getState().markUploaded(next);
      }
      if (result.ok) {
        showToast(`已补传 ${result.success} 个录像`, 'success');
      } else {
        showToast(
          `补传 ${result.success} 成功 / ${result.failed} 失败: ${result.lastError ?? ''}`,
          'error',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // 仅挂载时跑一次

  if (players.length === 0) return null;

  const currentPlayer = players[current_player_index];

  const handleQuit = async () => {
    setIsQuitting(true);
    // Electron 桌面环境：通过 IPC 直接退出
    if (window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
      return;
    }
    // 开发环境：通知 Vite 开发服务器退出
    try {
      await fetch('/api/quit');
    } catch (e) {
      console.log('Server is likely shutting down...');
    } finally {
      setShowExitModal(true);
    }
  };

  // P1.5: 保存录像（v2.2.0-alpha 网页版：上传到 Node 后端而非本地下载）
  const handleSaveReplay = async () => {
    if (isSavingReplay) return;
    setIsSavingReplay(true);
    // 模拟异步保存（实际是同步的，但展示 spinner 给用户反馈）
    setTimeout(async () => {
      // P1.6 修复：从 gameState 计算 winner 和 finalState
      // winner: 优先用 gameState.winner，否则从 HP 推算（>0 的玩家为胜者，全死为平局）
      const alivePlayers = gameState.players.filter(p => p.current_hp > 0);
      let winnerId: string | null = null;
      if (gameState.winner) {
        winnerId = gameState.winner.id;
      } else if (alivePlayers.length === 1) {
        winnerId = alivePlayers[0].id;
      } // else null (平局)
      // finalState: 映射 gameState.players 到 V1Replay finalState schema
      const finalState = {
        turn: gameState.turn,
        players: gameState.players.map(p => ({
          id: p.id,
          characterId: p.character_id,
          finalHP: p.current_hp,
          maxHP: p.max_hp,
          finalShield: p.shield,
          marks: p.marks.map(m => ({ name: m.name, remaining_turns: m.remaining_turns })),
        })),
      };
      const finalized = saveCurrentReplay({ winner: winnerId, finalState });
      if (finalized) {
        if (webMode) {
          // v2.2.0-alpha: 上传到后端
          const result = await uploadReplayToServer(finalized);
          if (result.ok) {
            showToast(`已上传录像 (id=${result.path ?? '?'})`, 'success');
          } else {
            // 失败入队列，等下次启动补传
            enqueuePending(finalized);
            showToast(`上传失败已入队列: ${result.error ?? '未知错误'}`, 'error');
          }
        } else {
          // 桌面/开发：保持原下载行为
          const result = await exportReplayAsJSONL(finalized);
          if (result.ok) {
            const dest = result.path ?? '(浏览器下载)';
            showToast(`已保存 ${finalized.moves.length} 个动作 → ${dest}`, 'success');
          } else {
            showToast(`保存失败: ${result.error ?? '未知错误'}`, 'error');
          }
        }
        // v2.2.1.2: 测试进度增量已迁移到 TestPage 监听器 (避免双重计数)
      } else {
        showToast('保存失败：当前没有可保存的录制', 'error');
      }
      setIsSavingReplay(false);
    }, 600);
  };

  // P1.5: 丢弃录像
  const handleDiscardReplay = () => {
    if (isSavingReplay) return;
    if (!confirm('确定丢弃本局录像？此操作不可撤销。')) return;
    discardCurrentReplay();
    showToast('已丢弃本局录像', 'info');
  };

  return (
    <>
      <AIController />
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-slate-900 to-green-950 flex flex-col relative">
      {/* 顶部信息栏 */}
      <div className="bg-black/30 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-white font-bold text-2xl">回合 {turn}</span>
          <PhaseIndicator phase={phase} />
        </div>
        <div className="flex items-center gap-4">
          {/* 时间银行 - LAN 模式阶段2 */}
          {isLAN && lanTimeBank && phase === 'phase2' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-600/20 border border-amber-500/30">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className={`font-mono font-bold ${lanTimeBank.remaining <= 30 ? 'text-red-400' : 'text-amber-400'}`}>
                {lanTimeBank.remaining}s
              </span>
            </div>
          )}
          {/* 当前行动 - 仅在阶段2显示 */}
          {phase === 'phase2' && (
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-base font-medium">
                当前行动：{currentPlayer?.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 游戏桌面 */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* 对手区域 (上方) - 精简卡片式 */}
        <div className="flex-1 flex gap-4">
          {players.filter(p => isLAN ? (p.id !== localPlayerId) : (p.type === 'ai')).map(opponent => (
            <div key={opponent.id} className="flex-1 max-w-[320px]">
              <EnemyCard
                player={opponent}
                seatLabel={`#${opponent.seat_index}`}
              />
            </div>
          ))}
        </div>

        {/* 中央区域 - 抽牌堆和弃牌堆 */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-green-800/30 rounded-2xl border-2 border-green-700/50 p-6 min-h-[200px]">
            <div className="text-center text-white/60 mb-4 text-lg">
              {phase === 'phase1' && '放置能量卡'}
              {phase === 'phase2' && '行动阶段'}
            </div>

            {/* 抽牌堆和弃牌堆 */}
            <div className="flex justify-center gap-8">
              <div className="flex flex-col items-center">
                <div className="w-20 h-28 bg-yellow-900/30 rounded-lg border border-yellow-600 flex flex-col items-center justify-center">
                  <Layers className="w-8 h-8 text-yellow-500" />
                  <span className="text-yellow-200 text-sm">{deck.length}</span>
                </div>
                <span className="text-yellow-300 text-sm mt-1">抽牌堆</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-20 h-28 bg-gray-700/30 rounded-lg border border-gray-500 flex flex-col items-center justify-center">
                  <Trash2 className="w-8 h-8 text-gray-400" />
                  <span className="text-gray-300 text-sm">{discard_pile.length}</span>
                </div>
                <span className="text-gray-300 text-sm mt-1">弃牌堆</span>
              </div>
            </div>
          </div>
        </div>

        {/* 玩家区域 (下方) */}
        <div className="flex-1">
          {players.filter(p => isLAN ? (p.id === localPlayerId) : (p.type === 'human')).map(humanPlayer => (
            <PlayerArea
              key={humanPlayer.id}
              player={humanPlayer}
              isCurrent={players[current_player_index]?.id === humanPlayer.id}
              isOpponent={false}
            />
          ))}
        </div>
      </div>

      {/* 底部操作栏 - 已简化为仅布局占位，操作整合入玩家区域 */}
      <div className="bg-black/30 backdrop-blur-sm px-6 py-1 h-2 flex items-center justify-between">
      </div>

      {/* 日志面板 - 可展开 */}
      <GameLog logs={gameState.logs} />

      {/* 换牌弹窗（仅非 LAN 模式） */}
      {!isLAN && phase === 'card_exchange' && players[current_player_index]?.type === 'human' && (
        <CardExchangeModal playerId={players[current_player_index].id} />
      )}

      {/* 能量放置弹窗 - 阶段1（仅非 LAN 模式） */}
      {!isLAN && phase === 'phase1' && players[current_player_index].type === 'human' && (
        <EnergySelectModal playerId={players[current_player_index].id} />
      )}

      {/* 能量放置结果弹窗（同时用于 LAN 模式展示行动顺序） */}
      {gameState.phase1_results && <EnergyResultModal />}

      {/* 胜利/失败界面 */}
      {phase === 'game_over' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-10 max-w-md w-full mx-4 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* 图标 */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
              gameState.winner?.type === 'human'
                ? 'bg-yellow-500/20'
                : 'bg-red-500/20'
            }`}>
              <span className={`text-5xl ${
                gameState.winner?.type === 'human' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {gameState.winner?.type === 'human' ? '🏆' : '💀'}
              </span>
            </div>

            <h2 className={`text-3xl font-bold mb-2 ${
              gameState.winner?.type === 'human' ? 'text-yellow-300' : 'text-red-300'
            }`}>
              {gameState.winner
                ? gameState.winner.type === 'human'
                  ? '胜利！'
                  : '失败...'
                : '平局！'}
            </h2>

            <p className="text-slate-400 text-sm mb-6">
              {gameState.winner
                ? `${gameState.winner.name} 赢得了比赛`
                : '所有玩家均已阵亡'}
            </p>

            {/* 存活玩家列表 */}
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
              <h3 className="text-white/60 text-xs font-medium uppercase tracking-wider mb-3">最终排名</h3>
              <div className="space-y-2">
                {[...gameState.players]
                  .sort((a, b) => {
                    if (a.current_hp <= 0 && b.current_hp <= 0) return 0;
                    if (a.current_hp <= 0) return 1;
                    if (b.current_hp <= 0) return -1;
                    return b.current_hp - a.current_hp;
                  })
                  .map((p, i) => (
                    <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      p.current_hp > 0 ? 'bg-green-900/20 border border-green-800/30' : 'bg-slate-800/30'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 ${p.current_hp > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>
                          #{i + 1}
                        </span>
                        <span className={`text-sm ${p.current_hp > 0 ? 'text-white' : 'text-slate-500'}`}>
                          {p.name}
                        </span>
                        {p.type === 'human' && (
                          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">你</span>
                        )}
                      </div>
                      <span className={`font-mono text-sm ${p.current_hp > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.current_hp > 0 ? `${p.current_hp}HP` : '阵亡'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* P1.5: 录制状态横幅 */}
            {currentReplay && (
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 mb-4 text-amber-200 text-sm">
                <div className="font-medium mb-1">📼 本局已录制 {currentReplay.moves.length} 个动作</div>
                <div className="text-xs text-amber-300/80">
                  {webMode
                    ? '点击下方按钮上传到云端（用于研究分析）'
                    : '请选择保存到本地或丢弃'}
                </div>
              </div>
            )}

            {/* v2.2.0-alpha: 待上传队列提示 */}
            {webMode && pendingUploads.length > 0 && (
              <div
                data-testid="victory-pending-banner"
                className="bg-amber-900/20 border border-amber-600/40 rounded-xl p-2 mb-3 text-amber-200 text-xs flex items-center gap-2"
              >
                <CloudUpload className="w-4 h-4" />
                <span>{pendingUploads.length} 个录像待补传（下次进入时自动重试）</span>
              </div>
            )}

            {/* P1.5: 保存/丢弃 + 重新开始 */}
            {currentReplay ? (
              <div className="space-y-2">
                <button
                  data-testid="victory-save-replay"
                  onClick={handleSaveReplay}
                  disabled={isSavingReplay}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-500 transition-colors shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingReplay ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {webMode ? '上传中...' : '保存中...'}
                    </>
                  ) : (
                    <>
                      {webMode ? <CloudUpload className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                      {webMode ? '上传录像' : '保存录像并下载'}
                    </>
                  )}
                </button>
                {/* 网页版隐藏丢弃按钮（强制上传采集） */}
                {!webMode && (
                  <button
                    data-testid="victory-discard-replay"
                    onClick={handleDiscardReplay}
                    disabled={isSavingReplay}
                    className="w-full py-2 bg-slate-700 text-slate-200 rounded-xl text-sm hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    丢弃本局录像
                  </button>
                )}
                <div className="border-t border-slate-700 my-3"></div>
                <button
                  onClick={() => window.location.reload()}
                  disabled={isSavingReplay}
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  重新开始
                </button>
              </div>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
              >
                重新开始
              </button>
            )}
          </div>
        </div>
      )}

      {/* 底部功能按钮组 */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        {/* 帮助按钮 */}
        <button
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/50 hover:border-blue-500 shadow-lg transition-all duration-300 group"
        >
          <HelpCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="font-medium">游戏帮助</span>
        </button>

        {/* 返回主界面按钮 */}
        <button
          onClick={() => onBack?.()}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-600/30 hover:bg-slate-600 text-slate-400 hover:text-white border border-slate-500/50 hover:border-slate-500 shadow-lg transition-all duration-300"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">返回主界面</span>
        </button>
      </div>

      {/* 帮助弹窗 */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* 弹窗头部 */}
            <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">游戏指南</h2>
                  <p className="text-xs text-slate-500">了解游戏规则、角色技能与卡牌效果</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 标签切换 */}
            <div className="px-8 py-2 bg-slate-800/30 flex gap-4">
              {[
                { id: 'rules', label: '基础规则', icon: Info },
                { id: 'chars', label: '角色百科', icon: User },
                { id: 'cards', label: '特殊卡牌', icon: Swords },
                { id: 'marks', label: '印记说明', icon: Layers },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setHelpTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                    helpTab === tab.id ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {helpTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {helpTab === 'rules' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <section>
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2 border-l-4 border-blue-500 pl-3">
                      核心流程
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                        <div className="text-blue-400 font-bold mb-2 text-sm uppercase">阶段 1: 能量放置</div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          所有玩家选择若干手牌背面放置。揭开后计算总能量（特殊卡计1点）。能量越高，阶段2行动顺序越靠前。
                        </p>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                        <div className="text-indigo-400 font-bold mb-2 text-sm uppercase">阶段 2: 玩家行动</div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          按顺序行动。除首回合外先摸2张卡。可以使用技能、特殊卡。技能需消耗手牌中的能量卡。
                        </p>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                        <div className="text-purple-400 font-bold mb-2 text-sm uppercase">阶段 3: 印记结算</div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          结算所有生效中的印记（正面/负面）。同名印记覆盖时间。血量归零则淘汰。
                        </p>
                      </div>
                    </div>
                  </section>
                  <section className="bg-red-900/10 border border-red-900/30 p-5 rounded-2xl">
                    <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                      <Swords className="w-5 h-5" /> 血战机制
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      当回合数超过 <span className="text-red-500 font-bold">20</span> 时进入血战期。每回合结算结束后，所有存活玩家将受到 <span className="text-red-500 font-bold">20点穿透伤害</span>。
                    </p>
                  </section>
                </div>
              )}

              {helpTab === 'chars' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {getAllCharacters().map(char => (
                    <div key={char.card_id} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 hover:bg-slate-800/60 transition-colors">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-bold text-white">{char.name}</h4>
                        <div className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30">
                          HP {char.hp}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {char.skills.map((skill, idx) => (
                          <div key={idx} className="bg-black/20 rounded-lg p-3 text-sm">
                            <div className="flex justify-between mb-1">
                              <span className="text-blue-400 font-bold">技能 {idx + 1}: {skill.name}</span>
                              <span className="text-slate-500 text-xs">消耗 {skill.cost}</span>
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed">{skill.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {helpTab === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {getSpecialCards().map(card => (
                    <div key={card.card_id} className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 font-bold text-xs shrink-0">
                          {card.effect_id}
                        </div>
                        <span className="text-white font-bold">{card.name}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{card.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {helpTab === 'marks' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h4 className="text-green-400 font-bold mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" /> 正面印记
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getAllMarks().filter(m => m.mark_type === 'positive').map(mark => (
                        <div key={mark.name} className="bg-green-900/10 border border-green-900/30 rounded-xl p-4">
                          <span className="text-white font-bold block mb-1">{mark.name}</span>
                          <p className="text-xs text-slate-400 leading-relaxed">{mark.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-red-400 font-bold mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" /> 负面印记
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getAllMarks().filter(m => m.mark_type === 'negative').map(mark => (
                        <div key={mark.name} className="bg-red-900/10 border border-red-900/30 rounded-xl p-4">
                          <span className="text-white font-bold block mb-1">{mark.name}</span>
                          <p className="text-xs text-slate-400 leading-relaxed">{mark.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 弹窗底部 */}
            <div className="px-8 py-4 border-t border-slate-800 bg-slate-900/80 text-center">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">
                Card Game Prototype v1.0.0
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 退出确认弹窗 */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100]">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Power className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">游戏已退出</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              后端服务器已成功关闭。为了安全起见，现在您可以手动关闭此浏览器标签页。
            </p>
            <div className="p-4 bg-black/40 rounded-xl border border-slate-700/50 text-sm text-slate-500">
              感谢参与本次卡牌原型测试
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}