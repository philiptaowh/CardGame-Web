// 阶段1能量放置弹窗 - 多选模式

import { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { Zap, Check, Hand } from 'lucide-react';

interface EnergySelectModalProps {
  playerId: string;
}

export function EnergySelectModal({ playerId }: EnergySelectModalProps) {
  const gameState = useGameStore(state => state.gameState);
  const placeEnergyCard = useGameStore(state => state.placeEnergyCard);
  const advancePhase = useGameStore(state => state.advancePhase);

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const [selectedCards, setSelectedCards] = useState<number[]>([]);

  // 所有手牌均可放置
  const handCards = player.hand
    .map((card, i) => ({ card, index: i }));

  const toggleCard = (index: number) => {
    setSelectedCards(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleSubmit = () => {
    // 放置所有选中的卡
    const sortedIndexes = [...selectedCards].sort((a, b) => b - a);
    sortedIndexes.forEach(cardIndex => {
      placeEnergyCard(playerId, cardIndex);
    });
    advancePhase();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-2 text-center">
          阶段1: 倡议竞标
        </h2>
        <p className="text-white/60 text-sm text-center mb-4">
          选择手牌放置以决定行动顺序（能量卡按值计，万能/特殊卡计1点）
        </p>

        {/* 卡牌列表 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {handCards.map(({ card, index }) => {
            const isSelected = selectedCards.includes(index);
            return (
              <div key={`${card.card_id}-${index}`} className="relative group">
                <button
                  onClick={() => toggleCard(index)}
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
                  {card.type === 'energy' ? (
                    <Zap className="w-6 h-6 text-yellow-500 mb-1" />
                  ) : (
                    <Hand className="w-6 h-6 text-red-500 mb-1" />
                  )}
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

        {handCards.length === 0 && (
          <p className="text-white/50 text-center py-4">
            没有卡牌可放置
          </p>
        )}

        {/* 已选数量提示 */}
        <div className="text-center text-white/70 mb-4">
          已选择: {selectedCards.length} 张
        </div>

        {/* 提交按钮 */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors"
          >
            确认放置
          </button>
        </div>

        <p className="text-white/40 text-xs text-center mt-4">
          选择能量卡后点击确认放置
        </p>
      </div>
    </div>
  );
}