import { useState, useMemo } from 'react';
import { Zap, Check, X } from 'lucide-react';
import type { Card, EnergyCard } from '../types';

interface SkillPaymentModalProps {
  skillName: string;
  skillCost: number;
  skillDescription: string;
  hand: Card[];
  onConfirm: (selectedIndices: number[]) => void;
  onCancel: () => void;
}

export function SkillPaymentModal({
  skillName,
  skillCost,
  skillDescription,
  hand,
  onConfirm,
  onCancel,
}: SkillPaymentModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // 仅筛选能量卡
  const energyCards = useMemo(() => {
    return hand
      .map((card, index) => ({ card, index }))
      .filter(item => item.card.type === 'energy');
  }, [hand]);

  // 计算当前选中的总能量
  const totalEnergy = useMemo(() => {
    let total = 0;
    // 先算普通能量
    selectedIndices.forEach(idx => {
      const card = hand[idx] as EnergyCard;
      if (!card.is_wild) {
        total += card.energy;
      }
    });
    // 再算万能能量（填补缺口，最高6）
    selectedIndices.forEach(idx => {
      const card = hand[idx] as EnergyCard;
      if (card.is_wild) {
        const gap = skillCost - total;
        total += Math.min(6, Math.max(1, gap));
      }
    });
    return total;
  }, [selectedIndices, hand, skillCost]);

  const canConfirm = totalEnergy >= skillCost;

  const toggleCard = (index: number) => {
    setSelectedIndices(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-slate-900 border-2 border-indigo-500 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            释放技能: <span className="text-indigo-400">{skillName}</span>
          </h2>
          <button onClick={onCancel} className="text-white/40 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 技能描述 */}
        <div className="mb-4 p-3 bg-black/40 border border-slate-700 rounded-xl">
          <p className="text-slate-300 text-sm leading-relaxed italic">
            {skillDescription}
          </p>
        </div>

        <div className="bg-indigo-900/30 rounded-lg p-3 mb-4 border border-indigo-500/30">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-indigo-200">所需能量</span>
            <span className="text-white font-bold">{skillCost}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-indigo-200">当前选择</span>
            <span className={`font-bold ${canConfirm ? 'text-green-400' : 'text-yellow-400'}`}>
              {totalEnergy}
            </span>
          </div>
          {/* 进度条 */}
          <div className="w-full bg-black/40 h-2 rounded-full mt-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${canConfirm ? 'bg-green-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(100, (totalEnergy / skillCost) * 100)}%` }}
            />
          </div>
        </div>

        <p className="text-white/60 text-xs mb-3 text-center">
          选择能量卡支付（万能卡根据需求补足缺口）
        </p>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {energyCards.map(({ card, index }) => {
            const isSelected = selectedIndices.includes(index);
            const ec = card as EnergyCard;
            return (
              <button
                key={`${card.card_id}-${index}`}
                onClick={() => toggleCard(index)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all relative h-20 ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-800 border-slate-700 hover:border-indigo-500/50'
                }`}
              >
                {isSelected && (
                  <Check className="w-4 h-4 text-white absolute -top-1 -right-1 z-10 bg-indigo-500 rounded-full" />
                )}
                <Zap className={`w-6 h-6 mb-1 ${ec.is_wild ? 'text-purple-400' : 'text-yellow-500'}`} />
                <span className="text-white text-xs font-bold">
                  {ec.is_wild ? '万能' : `${ec.energy}能量`}
                </span>
              </button>
            );
          })}
          {energyCards.length === 0 && (
            <div className="col-span-4 py-8 text-center text-white/30 text-sm">
              手牌中没有能量卡
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(selectedIndices)}
            disabled={!canConfirm}
            className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
              canConfirm 
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30' 
                : 'bg-slate-700 text-white/30 cursor-not-allowed'
            }`}
          >
            确认释放
          </button>
        </div>
      </div>
    </div>
  );
}