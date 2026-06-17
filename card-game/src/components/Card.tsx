// 卡牌组件

import type { Card as CardType } from '../types';
import { Zap, Star } from 'lucide-react';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
}

export function Card({ card, selected, onClick }: CardProps) {
  const isEnergy = card.type === 'energy';

  return (
    <button
      onClick={onClick}
      className={`relative w-20 h-28 rounded-lg border-2 transition-all hover:scale-105 hover:-translate-y-1 ${
        selected
          ? 'border-indigo-400 bg-indigo-800/50'
          : isEnergy
            ? 'border-yellow-600 bg-yellow-900/30 hover:border-yellow-500'
            : 'border-red-600 bg-red-900/30 hover:border-red-500'
      }`}
    >
      {/* 卡牌类型图标 */}
      <div className="absolute top-1 left-1">
        {isEnergy ? (
          <Zap className="w-4 h-4 text-yellow-500" />
        ) : (
          <Star className="w-4 h-4 text-red-500" />
        )}
      </div>

      {/* 卡牌名称 */}
      <div className="absolute inset-x-0 bottom-1 text-center">
        <span className="text-xs font-medium text-white">{card.name}</span>
        {isEnergy && 'energy' in card && (
          <span className="text-xs text-yellow-400 ml-1">{card.energy}</span>
        )}
      </div>
    </button>
  );
}

// 简单的卡牌显示（不作为按钮）
export function SimpleCard({ card }: { card: CardType }) {
  const isEnergy = card.type === 'energy';

  return (
    <div
      className={`w-20 h-28 rounded-lg border-2 ${
        isEnergy
          ? 'border-yellow-600 bg-yellow-900/30'
          : 'border-red-600 bg-red-900/30'
      }`}
    >
      <div className="absolute top-1 left-1">
        {isEnergy ? (
          <Zap className="w-4 h-4 text-yellow-500" />
        ) : (
          <Star className="w-4 h-4 text-red-500" />
        )}
      </div>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <span className="text-xs font-medium text-white">{card.name}</span>
      </div>
    </div>
  );
}