// 能量放置结果弹窗 - 显示阶段1能量结果和行动顺序

import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { ChevronRight, ChevronLeft, Zap, Trophy } from 'lucide-react';

export function EnergyResultModal() {
  const phase1Results = useGameStore(state => state.gameState.phase1_results);
  const actionOrder = useGameStore(state => state.gameState.action_order);
  const gameMode = useGameStore(state => state.gameState.gameMode);
  const turn = useGameStore(state => state.gameState.turn);

  const [showModal, setShowModal] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const shownTurnRef = useRef(0); // 记录已展示过的回合号，防止深克隆重复触发

  // 自动收缩到侧边栏（10秒后）
  useEffect(() => {
    if (!showModal || collapsed) return;

    timerRef.current = setTimeout(() => {
      setCollapsed(true);
    }, 10000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showModal, collapsed]);

  // 仅在新回合首次设置 phase1_results 时展示（按回合号去重）
  useEffect(() => {
    if (phase1Results && shownTurnRef.current !== turn) {
      setShowModal(true);
      setCollapsed(false);
      shownTurnRef.current = turn;
    }
  }, [phase1Results, turn]);

  if (!phase1Results || phase1Results.length === 0) return null;

  // 按行动顺序排序
  const sortedByOrder = [...phase1Results].sort(
    (a, b) => actionOrder.indexOf(a.playerId) - actionOrder.indexOf(b.playerId)
  );

  const handleExpand = () => {
    setCollapsed(false);
    setShowModal(true);
  };

  return (
    <>
      {/* 侧边栏收缩按钮 */}
      {collapsed && (
        <button
          onClick={handleExpand}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 bg-gradient-to-r from-indigo-600/90 to-indigo-700/90 hover:from-indigo-600 hover:to-indigo-700 text-white px-3 py-4 rounded-r-xl shadow-xl border border-indigo-500/50 border-l-0 transition-all group"
        >
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          <div className="flex flex-col items-center text-[10px] leading-tight font-medium">
            <Zap className="w-4 h-4 mb-0.5 text-yellow-300" />
            <span>能量</span>
            <span>排行</span>
          </div>
        </button>
      )}

      {/* 中央弹窗 */}
      {showModal && !collapsed && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl w-full max-w-md mx-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* 头部 */}
            <div className="bg-gradient-to-r from-indigo-600/30 to-purple-600/30 px-6 py-5 text-center border-b border-indigo-500/30">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl font-bold text-white">能量放置结果</h2>
                <Zap className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-indigo-300 text-xs">
                {gameMode === '1vn' ? '按能量值决定行动顺序' : '按能量值决定先后手'}
              </p>
            </div>

            {/* 排名列表 */}
            <div className="px-6 py-5 space-y-2">
              {sortedByOrder.map((entry, index) => {
                const isFirst = index === 0;
                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isFirst
                        ? 'bg-yellow-500/10 border border-yellow-500/40'
                        : 'bg-slate-800/50 border border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* 排名 */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        isFirst
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : index === 1
                            ? 'bg-gray-400/20 text-gray-400'
                            : index === 2
                              ? 'bg-amber-700/20 text-amber-600'
                              : 'bg-slate-600/20 text-slate-500'
                      }`}>
                        {index === 0 ? <Trophy className="w-4 h-4" /> : `#${index + 1}`}
                      </div>
                      {/* 玩家名称 */}
                      <span className={`font-medium ${isFirst ? 'text-yellow-200' : 'text-white'}`}>
                        {entry.name}
                      </span>
                      {/* v2.2.1.9: 「⚡先手」徽章 — 特殊卡 5 跨回合生效标记 */}
                      {entry.usedFirstStrikeCard && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-400/50"
                          title="上一回合使用特殊卡 5「先手」获得本回合优先行动权"
                          data-testid="first-strike-badge"
                        >
                          <Zap className="w-3 h-3" />
                          先手
                        </span>
                      )}
                    </div>

                    {/* 能量值 */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {entry.cardCount}张
                      </span>
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-base font-bold ${
                        isFirst
                          ? 'bg-yellow-500/15 text-yellow-300'
                          : 'bg-slate-700/50 text-slate-300'
                      }`}>
                        <Zap className={`w-4 h-4 ${isFirst ? 'text-yellow-400' : 'text-yellow-600'}`} />
                        {entry.energy}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 底部 */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
              <p className="text-slate-500 text-xs">
                10秒后自动收缩到侧边栏
              </p>
              <button
                onClick={() => setCollapsed(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                收起
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
