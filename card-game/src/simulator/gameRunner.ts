// GameRunner — 单局对局运行器
// V2 仿真平台组件
//
// 职责：初始化 GameEngine + 2×Policy → 驱动对局 → 输出 Replay
// 与 V1 共享 gameEngine.ts，但所有决策由外部策略驱动，而非引擎内置的 aiTurn()

import type { GameState, PlayerId, CharacterId, Card } from '../types';
import { GameEngine } from '../game/gameEngine';
import { getCharacterById } from '../game/characters';
import type { Action, IPlayerPolicy, PolicyParams } from '../ai/interfaces';
import { getOptimalParams } from '../ai/interfaces';
import { RuleBasedAI } from '../ai/ruleBasedAI';
import type { Replay, Move } from '../types/replay';
import { mulberry32, deriveSeed } from '../types/replay';

/** 对局运行配置 */
export interface GameRunnerConfig {
  /** 玩家1角色 ID */
  charId1: CharacterId;
  /** 玩家2角色 ID */
  charId2: CharacterId;
  /** 玩家1策略 */
  policy1: IPlayerPolicy;
  /** 玩家2策略 */
  policy2: IPlayerPolicy;
  /** 实验种子（用于派生对局种子） */
  experimentSeed: number;
  /** 对局索引（用于派生对局种子） */
  matchIndex?: number;
  /** 是否启用副日志（V2 moves 记录） */
  recordMoves?: boolean;
}

/** 运行单场对局 */
export function runGame(config: GameRunnerConfig): Replay {
  const {
    charId1, charId2, policy1, policy2,
    experimentSeed, matchIndex = 0,
    recordMoves = true,
  } = config;

  // 派生对局种子（不同 matchIndex → 不同牌序）
  const matchSeed = deriveSeed(experimentSeed, matchIndex);
  const prng = mulberry32(matchSeed);

  // 创建引擎（注入 PRNG）
  const engine = new GameEngine({ prng, seed: matchSeed });

  // 为两个策略注入与引擎相同的 PRNG（确保决策可复现）
  const policyPrng = mulberry32(deriveSeed(matchSeed, 0, 'policy'));
  policy1.setPRNG(policyPrng);
  policy2.setPRNG(policyPrng);

  // 初始化对局
  engine.initGame(charId1, [charId2], '1v1');

  // 覆盖所有玩家类型为 'human'，使 advanceExchange/advancePhase 不自动执行 AI 逻辑
  let s = engine.getState();
  s.players.forEach(p => { p.type = 'human'; });
  engine.loadState(s);

  const policyMap: Record<PlayerId, IPlayerPolicy> = {};
  s.players.forEach(p => {
    policyMap[p.id] = p.id === s.players[0].id ? policy1 : policy2;
  });

  const moves: Move[] = [];
  const startTime = Date.now();
  let lastPhase: string | null = null;

  // ============ 主循环 ============

  while (true) {
    s = engine.getState();
    if (s.phase === 'game_over') break;

    if (s.phase === 'card_exchange') {
      runExchangePhase(engine, s, policyMap, moves, recordMoves);
      s = engine.getState();
      continue;
    }

    // phase1 / phase2: 行动决策
    const currentPlayer = s.players[s.current_player_index];
    const policy = policyMap[currentPlayer.id];
    if (!policy) { engine.advancePhase(); continue; }

    const action = policy.decide(s, currentPlayer.id);
    if (recordMoves) {
      moves.push({
        turn: s.turn, phase: s.phase,
        playerId: currentPlayer.id, action,
      });
    }

    // 执行动作
    executeAction(engine, currentPlayer.id, action);

    // pass 后由引擎推进阶段
  }

  s = engine.getState();
  const endTime = Date.now();

  return buildReplay(s, moves, config, matchSeed, startTime, endTime, recordMoves);
}

// ==================== 换牌阶段处理 ====================

function runExchangePhase(
  engine: GameEngine,
  state: GameState,
  policyMap: Record<PlayerId, IPlayerPolicy>,
  moves: Move[],
  recordMoves: boolean,
): void {
  for (const player of state.players) {
    const policy = policyMap[player.id];
    if (!policy) continue;

    while (true) {
      let s = engine.getState();
      const p = s.players.find(p => p.id === player.id)!;
      if (p.remaining_exchanges <= 0) break;

      const action = policy.decide(s, player.id);
      if (recordMoves) {
        moves.push({ turn: s.turn, phase: 'card_exchange', playerId: player.id, action });
      }

      if (action.type === 'exchange') {
        engine.exchangeCard(player.id, action.cardIndex);
      } else {
        break;
      }
    }
  }

  // 直接推进到 phase1（绕过 advanceExchange 的自动 AI 逻辑）
  const s = engine.getState();
  s.players.forEach(p => { p.remaining_exchanges = 0; });
  s.phase = 'phase1';
  s.phase1_results = null;
  s.current_player_index = 0;
  engine.loadState(s);
}

// ==================== 动作执行 ====================

function executeAction(engine: GameEngine, playerId: PlayerId, action: Action): void {
  switch (action.type) {
    case 'place_energy':
      engine.placeEnergyCard(playerId, action.cardIndex);
      break;
    case 'use_skill':
      engine.useSkill(playerId, action.skillIndex, action.targetId, action.paymentCardIndices);
      break;
    case 'use_special_card':
      engine.useSpecialCard(playerId, action.cardIndex, action.targetId);
      break;
    case 'pass':
      if (engine.getState().phase === 'phase1' || engine.getState().phase === 'phase2') {
        engine.advancePhase();
      }
      break;
    default:
      // exchange handled separately in runExchangePhase
      break;
  }
}

// ==================== Replay 构建 ====================

function buildReplay(
  finalState: GameState,
  moves: Move[],
  config: GameRunnerConfig,
  matchSeed: number,
  startTime: number,
  endTime: number,
  recordMoves: boolean,
): Replay {
  const { charId1, charId2, policy1, policy2, matchIndex = 0 } = config;

  const winner = finalState.winner;
  const players = finalState.players;

  // 统计技能使用
  const skillUsage: Record<string, number> = {};
  for (const move of moves) {
    if (move.action.type === 'use_skill') {
      const char = getCharacterById(
        players.find(p => p.id === move.playerId)?.character_id ?? ''
      );
      if (char && char.skills[move.action.skillIndex]) {
        const name = char.skills[move.action.skillIndex].name;
        skillUsage[name] = (skillUsage[name] || 0) + 1;
      }
    }
  }

  const cardsDrawn = moves.filter(m => {
    // 粗略估算：每次 action 执行可能触发抽卡（drawCard 在 engine 内调用）
    return m.action.type === 'use_skill' || m.action.type === 'use_special_card';
  }).length * 2; // 简化：每次行动约抽 2 张

  return {
    version: '2.0.0',
    timestamp: startTime,
    duration: endTime - startTime,
    seed: matchSeed,
    config: {
      policies: [
        { playerId: players[0]?.id ?? 'p1', characterId: charId1, policyName: policy1.name, policyParams: { ...policy1.params } },
        { playerId: players[1]?.id ?? 'p2', characterId: charId2, policyName: policy2.name, policyParams: { ...policy2.params } },
      ],
    },
    moves: recordMoves ? moves : [],
    winner: winner?.id ?? null,
    finalState: {
      turn: finalState.turn,
      players: players.map(p => ({
        id: p.id,
        characterId: p.character_id,
        finalHP: p.current_hp,
        maxHP: p.max_hp,
        finalShield: p.shield,
        marks: p.marks.map(m => ({ name: m.name, remaining_turns: m.remaining_turns })),
      })),
    },
    stats: {
      totalMoves: moves.length,
      skillUsage,
      cardsDrawn,
      totalTurns: finalState.turn,
    },
  };
}

// ==================== 角色组合工厂 ====================

/** 所有 9 个角色的 ID */
export const ALL_CHARACTERS: CharacterId[] = [
  'char_1', 'char_2', 'char_3', 'char_4', 'char_5',
  'char_6', 'char_7', 'char_8', 'char_9',
];

/**
 * 用 BO 优化后的最优参数创建角色策略
 * @param charId  角色 ID（如 'char_1'）
 * @param name    策略名称（可选，默认 'optimal'）
 * @returns RuleBasedAI 实例
 */
export function createOptimizedPolicy(charId: CharacterId, name: string = 'optimal'): RuleBasedAI {
  const params = getOptimalParams(charId);
  if (!params) {
    throw new Error(`找不到 ${charId} 的最优参数`);
  }
  return new RuleBasedAI(name, params);
}

/**
 * 生成 36 个角色组合（不区分先后手，每个组合运行双向对局）
 * 返回 [charA, charB] 的元组数组
 */
export function generateMatchups(): Array<[CharacterId, CharacterId]> {
  const matchups: Array<[CharacterId, CharacterId]> = [];
  for (let i = 0; i < ALL_CHARACTERS.length; i++) {
    for (let j = i + 1; j < ALL_CHARACTERS.length; j++) {
      matchups.push([ALL_CHARACTERS[i], ALL_CHARACTERS[j]]);
    }
  }
  return matchups; // 36 组
}
