// 玩家区域组件

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import { getCharacterById } from '../game/characters';
import { getMarkDefinition } from '../game/marks';
import type { Player } from '../types';
import { Shield, Heart, Hand } from 'lucide-react';
import { SkillPaymentModal } from './SkillPaymentModal';
import { TargetSelectionModal } from './TargetSelectionModal';

interface PlayerAreaProps {
  player: Player;
  isCurrent: boolean;
  isOpponent: boolean;
}

export function PlayerArea({ player, isCurrent, isOpponent: _isOpponent }: PlayerAreaProps) {
  const gameState = useGameStore(state => state.gameState);
  const useSkill = useGameStore(state => state.useSkill);
  const useSpecialCard = useGameStore(state => state.useSpecialCard);
  const advancePhase = useGameStore(state => state.advancePhase);

  const [activeSkillIndex, setActiveSkillIndex] = useState<number | null>(null);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardHoverStart = (i: number) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredCardIndex(i);
  };

  const handleCardHoverEnd = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCardIndex(null);
    }, 300);
  };
  // 待选目标的状态（用于1vn模式）
  const [pendingTargetAction, setPendingTargetAction] = useState<{
    type: 'skill' | 'special';
    paymentIndices?: number[];
    cardIndex?: number;
  } | null>(null);

  useEffect(() => {
    return () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); };
  }, []);

  const { mode: lanMode, sendMessage: lanSend } = useNetworkStore();
  const isLAN = lanMode === 'lan';
  const char = getCharacterById(player.character_id);
  const currentPlayerIndex = gameState.players.findIndex(p => p.id === player.id);
  const isMyTurn = gameState.current_player_index === currentPlayerIndex;

  // 需要选择目标的特殊卡effect_id列表
  const TARGETING_SPECIAL_IDS = [1, 3, 4, 14, 15, 16];

  const handleOpenSkillPayment = (skillIndex: number) => {
    setActiveSkillIndex(skillIndex);
  };

  const handleConfirmSkill = (paymentIndices: number[]) => {
    if (activeSkillIndex === null) return;
    if (!char) return;

    const skill = char.skills[activeSkillIndex];

    // 自目标技能：直接以自己为目标
    if (skill.target === 'self') {
      useSkill(player.id, activeSkillIndex, player.id, paymentIndices);
      if (isLAN) lanSend?.({ type: 'use_skill', skillIndex: activeSkillIndex, targetId: player.id, paymentCardIndices: paymentIndices });
      setActiveSkillIndex(null);
      return;
    }

    if (gameState.gameMode === '1v1') {
      // 1v1模式：自动选择唯一对手
      const otherPlayers = gameState.players.filter(p => p.id !== player.id);
      const targetId = otherPlayers[0]?.id || player.id;
      useSkill(player.id, activeSkillIndex, targetId, paymentIndices);
      if (isLAN) lanSend?.({ type: 'use_skill', skillIndex: activeSkillIndex, targetId, paymentCardIndices: paymentIndices });
      setActiveSkillIndex(null);
    } else {
      // 1vn模式：先保存支付信息，弹出目标选择
      setPendingTargetAction({ type: 'skill', paymentIndices });
    }
  };

  const handleUseSpecialCard = (cardIndex: number) => {
    const card = player.hand[cardIndex];
    if (!card || card.type !== 'special') return;
    const needsTarget = TARGETING_SPECIAL_IDS.includes(card.effect_id);

    if (gameState.gameMode === '1v1' || !needsTarget) {
      // 1v1模式或无目标需求：直接使用
      const otherPlayers = gameState.players.filter(p => p.id !== player.id);
      const targetId = needsTarget ? (otherPlayers[0]?.id || player.id) : undefined;
      useSpecialCard(player.id, cardIndex, targetId);
      if (isLAN) lanSend?.({ type: 'use_special_card', cardIndex, targetId });
    } else {
      // 1vn模式且需要目标：弹出目标选择
      setPendingTargetAction({ type: 'special', cardIndex });
    }
  };

  const handleTargetSelect = (targetId: string) => {
    if (!pendingTargetAction) return;

    if (pendingTargetAction.type === 'skill') {
      useSkill(player.id, activeSkillIndex!, targetId, pendingTargetAction.paymentIndices!);
      if (isLAN) lanSend?.({ type: 'use_skill', skillIndex: activeSkillIndex!, targetId, paymentCardIndices: pendingTargetAction.paymentIndices! });
      setActiveSkillIndex(null);
    } else {
      useSpecialCard(player.id, pendingTargetAction.cardIndex!, targetId);
      if (isLAN) lanSend?.({ type: 'use_special_card', cardIndex: pendingTargetAction.cardIndex!, targetId });
    }
    setPendingTargetAction(null);
  };

  // 获取有效目标列表（非自身的存活玩家）
  const getValidTargets = (): Player[] => {
    return gameState.players.filter(p => p.id !== player.id && p.current_hp > 0);
  };

  return (
    <div className={`rounded-xl p-4 transition-all ${
      isCurrent
        ? 'bg-indigo-900/50 border-2 border-indigo-500'
        : 'bg-slate-800/30 border border-slate-700'
    }`}>
      {/* 玩家信息 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-xl">{player.name}</span>
          {player.type === 'ai' && (
            <span className="text-sm text-red-400">(AI)</span>
          )}
          {char && <span className="text-white/60 text-base">[{char.name}]</span>}
        </div>

        {/* HP 和护盾 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Heart className="w-5 h-5 text-red-500" />
            <span className="text-red-400 font-bold text-lg">
              {player.current_hp}/{player.max_hp}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-5 h-5 text-blue-500" />
            <span className="text-blue-400 font-bold text-lg">{player.shield}</span>
          </div>
        </div>
      </div>

      {/* 印记 */}
      {player.marks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {player.marks.map((mark, i) => {
            const def = getMarkDefinition(mark.name);
            const isPositive = def?.mark_type === 'positive';
            return (
              <span
                key={i}
                className={`px-2.5 py-1 text-sm rounded-full border ${
                  isPositive
                    ? 'bg-amber-600/30 text-amber-200 border-amber-500/30'
                    : 'bg-purple-600/50 text-purple-200 border-purple-500/30'
                }`}
              >
                {mark.name}({mark.remaining_turns})
              </span>
            );
          })}
        </div>
      )}

      {/* 手牌 - 人类玩家始终显示详情，AI对手只显示牌背 */}
      <div className="flex gap-1 overflow-x-auto py-2">
        {player.type === 'human' ? (
          // 人类玩家始终显示完整手牌
          player.hand.map((card, i) => {
            if (card.type === 'energy') {
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 w-14 h-20 rounded border text-sm flex flex-col items-center justify-center transition-all bg-yellow-900/50 border-yellow-600 text-yellow-200 opacity-90`}
                >
                  <span className="text-xs text-yellow-500/70">能量</span>
                  <span className="text-xl font-bold">{(card as any).is_wild ? 'W' : (card as any).energy}</span>
                </div>
              );
            }
            return (
              <div key={i} className="relative flex-shrink-0">
                <button
                  onClick={() => handleUseSpecialCard(i)}
                  disabled={!isMyTurn || gameState.phase !== 'phase2'}
                  onMouseEnter={() => handleCardHoverStart(i)}
                  onMouseLeave={handleCardHoverEnd}
                  className="w-14 h-20 rounded border text-sm transition-all hover:scale-105 bg-red-900/50 border-red-600 text-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {card.name.substring(0, 2)}
                </button>
                {hoveredCardIndex === i && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100]"
                    onMouseEnter={() => handleCardHoverStart(i)}
                    onMouseLeave={handleCardHoverEnd}
                  >
                    <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 shadow-xl max-w-[220px]">
                      <div className="text-red-300 font-bold text-xs">{card.name}</div>
                      <div className="text-slate-300 text-[11px] mt-0.5 leading-tight">{card.description}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // 对手只显示手牌背
          Array.from({ length: player.hand.length }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-12 h-16 rounded bg-blue-900/50 border border-blue-700 flex items-center justify-center"
            >
              <span className="text-blue-300 text-sm">?</span>
            </div>
          ))
        )}
        {player.hand.length === 0 && (
          <span className="text-white/30 text-base">无手牌</span>
        )}
      </div>

      {/* 手牌数量提示 (仅对手可见) */}
      {!isMyTurn && player.hand.length > 0 && (
        <div className="flex items-center gap-1 text-white/50 text-sm mt-1">
          <Hand className="w-4 h-4" />
          <span>{player.hand.length} 张手牌</span>
        </div>
      )}

      {/* 技能按钮 - 仅当前人类玩家可见 */}
      {isMyTurn && player.type === 'human' && gameState.phase === 'phase2' && char && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {char.skills.map((skill, i) => {
            return (
              <button
                key={i}
                onClick={() => handleOpenSkillPayment(i)}
                className="px-3 py-1.5 text-sm rounded transition-colors bg-indigo-700 hover:bg-indigo-600 text-white"
              >
                {skill.name}({skill.cost})
              </button>
            );
          })}
          <button
            onClick={() => {
              if (isLAN) lanSend?.({ type: 'end_action' });
              advancePhase();
            }}
            className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
          >
            结束行动
          </button>
        </div>
      )}

      {/* 技能支付弹窗 */}
      {activeSkillIndex !== null && char && (
        <SkillPaymentModal
          skillName={char.skills[activeSkillIndex].name}
          skillCost={char.skills[activeSkillIndex].cost}
          skillDescription={char.skills[activeSkillIndex].description}
          hand={player.hand}
          onConfirm={handleConfirmSkill}
          onCancel={() => setActiveSkillIndex(null)}
        />
      )}

      {/* 目标选择弹窗（1vn模式） */}
      {pendingTargetAction && (
        <TargetSelectionModal
          title={pendingTargetAction.type === 'skill' ? '选择技能目标' : '选择卡牌目标'}
          description="选择一个目标玩家"
          targets={getValidTargets()}
          onSelect={handleTargetSelect}
          onCancel={() => {
            setPendingTargetAction(null);
            if (pendingTargetAction.type === 'skill') {
              setActiveSkillIndex(null);
            }
          }}
        />
      )}

      {/* AI 自动行动提示 */}
      {isCurrent && player.type === 'ai' && (
        <div className="mt-2 text-center text-white/50 text-base animate-pulse">
          AI 思考中...
        </div>
      )}
    </div>
  );
}
