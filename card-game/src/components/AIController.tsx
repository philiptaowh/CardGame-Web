// AI 自动行动控制器 - 纯逻辑组件，无 UI 输出
// 监听游戏状态，在轮到 AI 玩家时自动触发 aiTurn()

import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';

export function AIController() {
  const gameState = useGameStore(state => state.gameState);
  const aiTurn = useGameStore(state => state.aiTurn);
  const advanceExchange = useGameStore(state => state.advanceExchange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentPlayer = gameState.players[gameState.current_player_index];
    if (!currentPlayer || currentPlayer.type !== 'ai') return;

    // 换牌阶段 → 调用 advanceExchange 处理 AI 自动换牌
    if (gameState.phase === 'card_exchange') {
      timerRef.current = setTimeout(() => {
        advanceExchange();
      }, 1000);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }

    const isActionPhase = gameState.phase === 'phase1' || gameState.phase === 'phase2';
    if (!isActionPhase) return;

    // AI 已行动过则跳过
    if (gameState.phase === 'phase2' && currentPlayer.has_acted_this_turn) return;

    // 延迟触发 AI 行动，让 UI 有时间更新
    timerRef.current = setTimeout(() => {
      aiTurn();
    }, 1500);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState.current_player_index, gameState.phase, gameState.turn]);

  return null;
}
