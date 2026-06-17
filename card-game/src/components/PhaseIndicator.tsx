// 阶段指示器

import type { GamePhase } from '../types';

interface PhaseIndicatorProps {
  phase: GamePhase;
}

const phaseLabels: Record<GamePhase, string> = {
  setup: '设置',
  card_exchange: '换牌',
  phase1: '阶段1: 能量',
  phase2: '阶段2: 行动',
  phase3: '阶段3: 结算',
  game_over: '结束',
};

const phaseColors: Record<GamePhase, string> = {
  setup: 'bg-gray-600',
  card_exchange: 'bg-teal-600',
  phase1: 'bg-yellow-600',
  phase2: 'bg-blue-600',
  phase3: 'bg-purple-600',
  game_over: 'bg-red-600',
};

export function PhaseIndicator({ phase }: PhaseIndicatorProps) {
  return (
    <span className={`px-3 py-1 rounded-full text-base text-white ${phaseColors[phase]}`}>
      {phaseLabels[phase]}
    </span>
  );
}