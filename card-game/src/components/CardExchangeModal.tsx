// 换牌弹窗 - 游戏开局换牌阶段

import { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { RotateCw, Check, Hand } from 'lucide-react';

interface CardExchangeModalProps {
  playerId: string;
}

export function CardExchangeModal({ playerId }: CardExchangeModalProps) {
  const gameState = useGameStore(state => state.gameState);
  const exchangeCard = useGameStore(state => state.exchangeCard);
  const advanceExchange = useGameStore(state => state.advanceExchange);

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const remaining = player.remaining_exchanges;

  const handleExchange = () => {
    if (selectedIndex === null) return;
    exchangeCard(playerId, selectedIndex);
    setSelectedIndex(null);
  };

  const handleSkip = () => {
    advanceExchange();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-2 text-center">
          换牌阶段
        </h2>
        <p className="text-white/60 text-sm text-center mb-1">
          选择一张手牌放回牌组底部，然后抽取一张新卡
        </p>
        <p className="text-indigo-400 text-sm text-center mb-4">
          剩余换牌次数: {remaining}
        </p>

        {/* 手牌列表 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {player.hand.map((card, index) => {
            const isSelected = selectedIndex === index;
            return (
              <div key={`${card.card_id}-${index}`} className="relative group">
                <button
                  onClick={() => setSelectedIndex(isSelected ? null : index)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all w-full ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-400 scale-105'
                      : card.type === 'energy'
                        ? 'bg-yellow-900/50 border-yellow-600 hover:bg-yellow-800'
                        : 'bg-red-900/50 border-red-600 hover:bg-red-800'
                  }`}
                >
                  {isSelected && (
                    <Check className="w-4 h-4 text-white absolute -top-1 -right-1 z-10 bg-indigo-500 rounded-full" />
                  )}
                  <Hand className="w-6 h-6 mb-1 text-white/70" />
                  <span className="text-white text-xs font-medium text-center">
                    {card.type === 'energy'
                      ? ((card as any).is_wild ? '万能' : `${(card as any).energy}能量`)
                      : card.name
                    }
                  </span>
                </button>
                {card.type === 'special' && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 shadow-xl max-w-[220px]">
                      <div className="text-red-300 font-bold text-xs">{card.name}</div>
                      <div className="text-slate-300 text-[11px] mt-0.5 leading-tight">{card.description}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {player.hand.length === 0 && (
          <p className="text-white/50 text-center py-4">没有手牌可交换</p>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={handleExchange}
            disabled={selectedIndex === null}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            换牌
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            结束换牌
          </button>
        </div>

        <p className="text-white/40 text-xs text-center mt-4">
          选择一张卡后点击"换牌"
        </p>
      </div>
    </div>
  );
}
