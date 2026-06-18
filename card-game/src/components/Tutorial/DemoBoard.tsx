// DemoBoard — 教学演示的 mini 游戏面板
//
// 设计：
// - 接收 initialState（来自 step.content.state）
// - 接收 expectedEndState（校验玩家交互是否完成）
// - 内部用 useReducer 管理状态机
// - HP/shield 数值平滑过渡（CSS transition）
// - 交互步骤：玩家点击技能/特殊卡 → 弹支付窗口 → 选卡确认 → 状态过渡到 expected
//
// 状态机：
//   idle → awaiting_action → showing_payment → applying_action → completed

import { useReducer, useEffect, useState } from 'react';
import type { DemoState, DemoAction as DA } from './tutorialSteps';
import { DemoCharacterCard } from './DemoCharacterCard';
import { DemoSpecialCard } from './DemoSpecialCard';
import { DemoLog } from './DemoLog';
import { DemoEnergyPayment } from './DemoEnergyPayment';

type DemoPhase = 'idle' | 'awaiting_action' | 'showing_payment' | 'completed';

interface DemoBoardState {
  gameState: DemoState;
  phase: DemoPhase;
  pendingSkillIndex: number | null;
  selectedPaymentCard: number | null;
}

type DemoBoardAction =
  | { type: 'CLICK_SKILL'; skillIndex: number }
  | { type: 'CLICK_SPECIAL'; cardIndex: number }
  | { type: 'OPEN_PAYMENT'; skillIndex: number }
  | { type: 'CLOSE_PAYMENT' }
  | { type: 'SELECT_PAYMENT_CARD'; cardIndex: number }
  | { type: 'CONFIRM_PAYMENT' };

function demoReducer(state: DemoBoardState, action: DemoBoardAction): DemoBoardState {
  switch (action.type) {
    case 'CLICK_SKILL':
      // 玩家点击技能 → 弹能量支付窗口
      return {
        ...state,
        phase: 'showing_payment',
        pendingSkillIndex: action.skillIndex,
        selectedPaymentCard: null,
      };
    case 'CLICK_SPECIAL':
      // 玩家点击特殊卡 → 直接生效（特殊卡不消耗能量）
      // 模拟「攻击强化」效果：获得红色「强化」印记（type='negative' 触发标红样式，视觉强调）
      return {
        ...state,
        phase: 'completed',
        gameState: {
          ...state.gameState,
          player: {
            ...state.gameState.player,
            marks: [{ name: '强化', type: 'negative' }],
          },
          log: [
            ...state.gameState.log,
            '→ 平衡 使用 攻击强化，下一技能伤害 +50%',
          ],
        },
      };
    case 'OPEN_PAYMENT':
      return {
        ...state,
        phase: 'showing_payment',
        pendingSkillIndex: action.skillIndex,
      };
    case 'CLOSE_PAYMENT':
      return {
        ...state,
        phase: 'awaiting_action',
        pendingSkillIndex: null,
        selectedPaymentCard: null,
      };
    case 'SELECT_PAYMENT_CARD':
      return {
        ...state,
        selectedPaymentCard: action.cardIndex,
      };
    case 'CONFIRM_PAYMENT': {
      // 模拟技能释放：普通攻击对进攻造成 10 伤害
      const damage = 10;
      const newOpponentHp = Math.max(0, state.gameState.opponent.hp - damage);
      return {
        ...state,
        phase: 'completed',
        pendingSkillIndex: null,
        selectedPaymentCard: null,
        gameState: {
          ...state.gameState,
          opponent: {
            ...state.gameState.opponent,
            hp: newOpponentHp,
          },
          log: [
            ...state.gameState.log,
            `→ 平衡 对 ${state.gameState.opponent.name} 造成 ${damage} 伤害`,
          ],
        },
      };
    }
    default:
      return state;
  }
}

interface DemoBoardProps {
  initialState: DemoState;
  expectedEndState?: Partial<DemoState>;
  onComplete?: () => void;
}

export function DemoBoard({ initialState, expectedEndState, onComplete }: DemoBoardProps) {
  const [state, dispatch] = useReducer(demoReducer, {
    gameState: initialState,
    phase: expectedEndState ? 'awaiting_action' : 'idle',
    pendingSkillIndex: null,
    selectedPaymentCard: null,
  });

  // 自动播放演示（非交互步骤）：完成后通知父组件
  const [autoProgress, setAutoProgress] = useState(0);
  useEffect(() => {
    if (state.phase !== 'idle' || expectedEndState) return;
    // 简单的"自动播放"：每 1.2s 让一个 log 行淡入
    if (autoProgress < initialState.log.length) {
      const timer = setTimeout(() => setAutoProgress((p) => p + 1), 600);
      return () => clearTimeout(timer);
    }
    // 所有 log 行显示完毕后通知完成
    if (onComplete && autoProgress === initialState.log.length) {
      const timer = setTimeout(onComplete, 800);
      return () => clearTimeout(timer);
    }
  }, [state.phase, autoProgress, initialState.log.length, expectedEndState, onComplete]);

  // 交互步骤完成后通知父组件
  useEffect(() => {
    if (state.phase === 'completed' && onComplete) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.phase, onComplete]);

  const isCompleted = state.phase === 'completed';
  const visibleLog = expectedEndState
    ? state.gameState.log
    : state.gameState.log.slice(0, autoProgress);

  return (
    <div className="space-y-4" data-testid="demo-board">
      {/* 顶部状态条 */}
      <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-800/50 rounded-xl px-4 py-2">
        <span>
          回合 <span className="text-white font-bold">{state.gameState.turn}</span>
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-white ${
            state.gameState.phase === 'phase1'
              ? 'bg-yellow-600'
              : state.gameState.phase === 'phase2'
              ? 'bg-blue-600'
              : state.gameState.phase === 'phase3'
              ? 'bg-purple-600'
              : 'bg-red-600'
          }`}
        >
          {state.gameState.phase === 'phase1'
            ? '阶段 1 · 能量'
            : state.gameState.phase === 'phase2'
            ? '阶段 2 · 行动'
            : state.gameState.phase === 'phase3'
            ? '阶段 3 · 结算'
            : '结束'}
        </span>
      </div>

      {/* 双方角色卡 */}
      <div className="grid grid-cols-2 gap-4">
        <DemoCharacterCard
          character={state.gameState.player}
          isOpponent={false}
          highlight={
            state.gameState.highlight === 'player' ||
            state.gameState.highlight === 'player-energy' ||
            state.gameState.highlight === 'player-skill-1'
          }
          highlightSkillIndex={
            state.gameState.highlight === 'player-skill-1' ? 0 : undefined
          }
          showSkills={
            state.phase === 'awaiting_action' ||
            state.phase === 'showing_payment' ||
            state.phase === 'completed'
          }
          onSkillClick={(idx) => dispatch({ type: 'CLICK_SKILL', skillIndex: idx })}
          disabled={isCompleted}
          phase={state.gameState.phase}
        />
        <DemoCharacterCard
          character={state.gameState.opponent}
          isOpponent={true}
          highlight={state.gameState.highlight === 'opponent'}
          showSkills={false}
          disabled={true}
          phase={state.gameState.phase}
        />
      </div>

      {/* 玩家手牌（仅 step 5 显示特殊卡） */}
      {state.gameState.highlight === 'player-special-attack-up' && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
          <div className="text-xs text-slate-500 mb-2">手牌（平衡）</div>
          <div className="flex gap-3">
            <div className="text-slate-500 text-xs flex items-center px-3 py-2">能量×2</div>
            <DemoSpecialCard
              name="攻击强化"
              onClick={() => dispatch({ type: 'CLICK_SPECIAL', cardIndex: 0 })}
              disabled={isCompleted}
            />
          </div>
        </div>
      )}

      {/* 日志 */}
      <DemoLog lines={visibleLog} />

      {/* 能量支付弹窗 */}
      {state.phase === 'showing_payment' && (
        <DemoEnergyPayment
          cost={1}
          selectedCard={state.selectedPaymentCard}
          onSelect={(idx) => dispatch({ type: 'SELECT_PAYMENT_CARD', cardIndex: idx })}
          onConfirm={() => dispatch({ type: 'CONFIRM_PAYMENT' })}
          onCancel={() => dispatch({ type: 'CLOSE_PAYMENT' })}
        />
      )}
    </div>
  );
}