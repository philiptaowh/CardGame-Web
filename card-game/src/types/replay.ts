// V2 仿真平台 — Replay 数据结构
// 每场对局输出一个 Replay 记录
// 参见 卡牌游戏2.0原型.md §3.1

import type { PlayerId, GamePhase, CharacterId, Player } from './index';
import type { Action, PolicyParams } from '../ai/interfaces';
import type { GameEngine } from '../game/gameEngine';

// ============ 单局记录 ============

/** 单步动作记录 */
export interface Move {
  turn: number;
  phase: GamePhase;
  playerId: PlayerId;
  action: Action;
  /** 动作前的状态指纹（可选，用于校验） */
  stateHash?: string;
}

/** 对局策略配置 */
export interface ReplayPolicyConfig {
  playerId: PlayerId;
  characterId: CharacterId;
  policyName: string;
  policyParams: PolicyParams;
}

/** 完整 Replay 记录 */
export interface Replay {
  /** 数据格式版本 */
  version: string;
  /** Unix ms，对局开始时间 */
  timestamp: number;
  /** 毫秒，对局时长 */
  duration: number;
  /** 引擎随机种子（可复现用） */
  seed: number;
  /** 对局配置 */
  config: {
    policies: ReplayPolicyConfig[];
  };
  /** 有序决策序列 */
  moves: Move[];
  /** 胜利者 ID（null = 平局/超时） */
  winner: PlayerId | null;
  /** 终局状态摘要 */
  finalState: {
    turn: number;
    players: Array<{
      id: PlayerId;
      characterId: CharacterId;
      finalHP: number;
      maxHP: number;
      finalShield: number;
      marks: Array<{ name: string; remaining_turns: number }>;
    }>;
  };
  /** 聚合摘要 */
  stats: {
    totalMoves: number;
    skillUsage: Record<string, number>;
    cardsDrawn: number;
    totalTurns: number;
  };
}

// ============ 批量运行结果 ============

/** 单场对局结果摘要 */
export interface MatchResult {
  replay: Replay;
  winnerId: PlayerId | null;
  winnerCharacter: CharacterId | null;
  loserCharacter: CharacterId | null;
  duration: number;
  turnCount: number;
}

/** 批量统计数据 */
export interface BatchStats {
  totalGames: number;
  /** 胜率矩阵 [characterId][characterId] = winRate */
  winRateMatrix: Record<string, Record<string, number>>;
  durationStats: { mean: number; median: number; p95: number };
  turnStats: { mean: number; median: number; max: number };
  skillUsage: Record<string, number>;
}

// ============ 种子工具 ============

/**
 * 简单的 32 位乘法哈希（简单版 SHA256 替代）
 * 用于派生对局种子：seed_match = hash(seed_experiment || matchIndex || "match")
 */
export function deriveSeed(baseSeed: number, matchIndex: number, salt: string = 'match'): number {
  let h = baseSeed >>> 0;
  h = ((h * 0x9e3779b9) ^ matchIndex) >>> 0;
  for (let i = 0; i < salt.length; i++) {
    h = ((h * 0x9e3779b9) ^ salt.charCodeAt(i)) >>> 0;
  }
  // 确保不为 0
  return h || 1;
}

/**
 * 简单的 mulberry32 PRNG（根据种子生成 0~1 浮点数）
 * 用于 V2 仿真中替代节点 crypto 依赖
 * 通过 BigCrush 统计测试的子集
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
