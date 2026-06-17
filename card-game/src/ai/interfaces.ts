// AI 策略体系 — 接口定义与数据结构
// V2 仿真平台组件，与 V1 stores 无依赖

import type { GameState, PlayerId, PRNG } from '../types';

// ============ 动作类型 ============

/**
 * 策略决策的输出动作
 * 由 GameRunner 翻译为 engine 方法调用
 */
export type Action =
  | { type: 'pass' }
  | { type: 'exchange'; cardIndex: number }
  | { type: 'place_energy'; cardIndex: number }
  | { type: 'use_skill'; skillIndex: number; targetId: PlayerId; paymentCardIndices: number[] }
  | { type: 'use_special_card'; cardIndex: number; targetId?: PlayerId };

// ============ 策略超参数（θ）============

/**
 * 策略超参数空间 Θ
 * 参见 卡牌游戏2.0原型.md §2.3
 */
export interface PolicyParams {
  /** θ_priority: 行动顺序权重 [0,1] — 高=抢先行，低=保留能量给技能 */
  priority: number;
  /** θ_wild: 万能能量策略 */
  wild: 'keep' | 'place' | 'bal';
  /** θ_hp_danger: HP 危险阈值 [0.2, 0.5] — 低于此优先回复/护盾 */
  hp_danger: number;
  /** θ_aggro: 进攻倾向 [0,1] — 目标选择中伤害权重 vs 防御权重 */
  aggro: number;
  /** θ_mark_weight: 印记感知系数 [0,2] — 目标身上印记的加权 */
  mark_weight: number;
  /** θ_skill_pref: 4个技能的相对优先级权重 [0,1]⁴ */
  skill_pref: [number, number, number, number];
  /** θ_special_threshold: 特殊卡使用阈值 [0,1] — 血量低于此比例时使用回复类特殊卡 */
  special_threshold: number;
  /** θ_noise: 随机扰动 [0,0.2] — 以该概率随机选择而非最优 */
  noise: number;
}

// ============ 预设策略配置 ============

/** 预设策略名称 -> 参数 映射表（≥ 8 组） */
export const STRATEGY_PRESETS: Record<string, PolicyParams> = {
  /** 激进：低血量也优先输出，抢先行动 */
  aggressive: {
    priority: 0.8, wild: 'place', hp_danger: 0.25, aggro: 0.9,
    mark_weight: 0.5, skill_pref: [0.15, 0.05, 0.4, 0.4],
    special_threshold: 0.3, noise: 0.05,
  },
  /** 保守：血量安全才进攻，留能量 */
  conservative: {
    priority: 0.2, wild: 'keep', hp_danger: 0.40, aggro: 0.3,
    mark_weight: 1.0, skill_pref: [0.1, 0.4, 0.3, 0.2],
    special_threshold: 0.6, noise: 0.05,
  },
  /** 均衡：平衡攻防，动态决策 */
  balanced: {
    priority: 0.5, wild: 'bal', hp_danger: 0.35, aggro: 0.5,
    mark_weight: 1.0, skill_pref: [0.25, 0.25, 0.25, 0.25],
    special_threshold: 0.5, noise: 0.05,
  },
  /** 控场：注重印记控制 */
  controller: {
    priority: 0.4, wild: 'bal', hp_danger: 0.30, aggro: 0.4,
    mark_weight: 1.5, skill_pref: [0.2, 0.1, 0.5, 0.2],
    special_threshold: 0.4, noise: 0.05,
  },
  /** 爆发：集中打高费技能，追求单轮高输出 */
  burst: {
    priority: 0.7, wild: 'place', hp_danger: 0.30, aggro: 0.8,
    mark_weight: 0.5, skill_pref: [0.1, 0.1, 0.2, 0.6],
    special_threshold: 0.3, noise: 0.05,
  },
  /** 消耗：打持久战，注重资源效率 */
  endurance: {
    priority: 0.3, wild: 'keep', hp_danger: 0.45, aggro: 0.3,
    mark_weight: 1.2, skill_pref: [0.3, 0.3, 0.2, 0.2],
    special_threshold: 0.5, noise: 0.05,
  },
  /** 贪婪：风险偏好高，低血量也进攻 */
  greedy: {
    priority: 0.6, wild: 'bal', hp_danger: 0.20, aggro: 0.7,
    mark_weight: 0.8, skill_pref: [0.15, 0.15, 0.35, 0.35],
    special_threshold: 0.2, noise: 0.1,
  },
  /** 自保：优先保命 */
  survivalist: {
    priority: 0.1, wild: 'keep', hp_danger: 0.50, aggro: 0.2,
    mark_weight: 1.5, skill_pref: [0.2, 0.5, 0.2, 0.1],
    special_threshold: 0.7, noise: 0.05,
  },
  /** 赌徒：高随机性 */
  gambler: {
    priority: 0.5, wild: 'bal', hp_danger: 0.30, aggro: 0.6,
    mark_weight: 1.0, skill_pref: [0.25, 0.25, 0.25, 0.25],
    special_threshold: 0.5, noise: 0.2,
  },
  /** 先手大师：极致抢先手 */
  speed: {
    priority: 1.0, wild: 'place', hp_danger: 0.35, aggro: 0.6,
    mark_weight: 0.5, skill_pref: [0.3, 0.3, 0.2, 0.2],
    special_threshold: 0.4, noise: 0.02,
  },
};

/** 获取所有预设策略名称列表 */
export function getPresetNames(): string[] {
  return Object.keys(STRATEGY_PRESETS);
}

/** 获取预设策略参数（深拷贝） */
export function getPresetParams(name: string): PolicyParams | undefined {
  const p = STRATEGY_PRESETS[name];
  return p ? { ...p } : undefined;
}

// ============ 每个角色的最优超参数（BO 贝叶斯优化结果）============

/**
 * 每个角色最优 θ 参数（通过 GPU 贝叶斯优化得到，11 维搜索空间）
 *
 * 优化目标：最大化该角色 vs 9 角色 × 6 策略池的胜率
 * 优化引擎：BoTorch (SingleTaskGP + qLogExpectedImprovement) on CUDA
 * 搜索空间：priority, hp_danger, aggro, mark_weight, special_threshold,
 *           wild(categorical), skill_pref_0..3(simplex), noise
 * 每点评估：54 局（9 对手 × 6 策略）
 */
export const CHARACTER_OPTIMAL_PARAMS: Record<string, PolicyParams> = {
  // char_1 — 平衡 Balance (best_winrate=0.5926, +0.0% vs old 0.6204)
  "char_1": {
    priority: 0.2401,
    wild: "bal",
    hp_danger: 0.2487,
    aggro: 0.5738,
    mark_weight: 0.5525,
    skill_pref: [0.7845, 0.6872, 0.6951, 0.4969],
    special_threshold: 0.4031,
    noise: 0.1951,
  },
  // char_2 — 防御 Defense (best_winrate=0.6481, +10.2% vs old 0.5463)
  "char_2": {
    priority: 0.2455,
    wild: "keep",
    hp_danger: 0.2554,
    aggro: 0.7855,
    mark_weight: 0.1257,
    skill_pref: [0.0253, 0.3481, 0.4877, 0.3895],
    special_threshold: 0.8058,
    noise: 0.0728,
  },
  // char_3 — 进攻 Offense (best_winrate=0.8333, +0.9% vs old 0.8241)
  "char_3": {
    priority: 0.5992,
    wild: "keep",
    hp_danger: 0.4572,
    aggro: 0.5512,
    mark_weight: 0.1647,
    skill_pref: [0.7783, 0.5488, 0.8458, 0.0764],
    special_threshold: 0.7335,
    noise: 0.0077,
  },
  // char_4 — 强化 Buffer (best_winrate=0.8333, -1.0% vs old 0.8426)
  "char_4": {
    priority: 0.0631,
    wild: "bal",
    hp_danger: 0.3137,
    aggro: 0.7407,
    mark_weight: 0.9868,
    skill_pref: [0.4999, 0.2487, 0.3259, 0.8711],
    special_threshold: 0.3134,
    noise: 0.0109,
  },
  // char_5 — 先手 First (best_winrate=0.4630, -9.3% vs old 0.5556)
  "char_5": {
    priority: 0.2913,
    wild: "bal",
    hp_danger: 0.4061,
    aggro: 0.8169,
    mark_weight: 0.1967,
    skill_pref: [0.5082, 0.3599, 0.7626, 0.0257],
    special_threshold: 0.9208,
    noise: 0.1305,
  },
  // char_6 — 持久 Sustain (best_winrate=0.9444, ±0.0% vs old 0.9444)
  "char_6": {
    priority: 0.1916,
    wild: "bal",
    hp_danger: 0.3940,
    aggro: 0.6976,
    mark_weight: 1.3461,
    skill_pref: [0.3104, 0.9509, 0.4723, 0.8991],
    special_threshold: 0.2847,
    noise: 0.1308,
  },
  // char_7 — 弱化 Debuffer (best_winrate=0.2130, -4.6% vs old 0.2593)
  "char_7": {
    priority: 0.8929,
    wild: "keep",
    hp_danger: 0.4058,
    aggro: 0.1831,
    mark_weight: 0.6764,
    skill_pref: [0.4116, 0.2128, 0.8927, 0.6280],
    special_threshold: 0.3949,
    noise: 0.1541,
  },
  // char_8 — 反击 Counter (best_winrate=0.5833, +0.9% vs old 0.5741)
  "char_8": {
    priority: 0.3371,
    wild: "bal",
    hp_danger: 0.4917,
    aggro: 0.7818,
    mark_weight: 1.8898,
    skill_pref: [0.1300, 0.3908, 0.2129, 0.1108],
    special_threshold: 0.7232,
    noise: 0.1236,
  },
  // char_9 — 连击 Combo (best_winrate=0.2963, -1.9% vs old 0.3148)
  "char_9": {
    priority: 0.6102,
    wild: "keep",
    hp_danger: 0.3472,
    aggro: 0.5769,
    mark_weight: 1.9666,
    skill_pref: [0.7486, 0.7688, 0.3785, 0.3655],
    special_threshold: 0.4747,
    noise: 0.1627,
  },
};

/** 获取角色最优参数（深拷贝），找不到时返回 undefined */
export function getOptimalParams(charId: string): PolicyParams | undefined {
  const p = CHARACTER_OPTIMAL_PARAMS[charId];
  return p ? { ...p } : undefined;
}

// ============ 策略接口 ============

/**
 * IPlayerPolicy — 策略接口
 *
 * 每个策略实现在构造时绑定固定的超参数 θ，
 * decide() 在每次需要决策时被调用，返回一个 Action。
 *
 * 策略是**无状态**的：不依赖内部缓存，每次 decide() 只基于 state 参数做决策。
 */
export interface IPlayerPolicy {
  /** 策略名称（用于标识和日志） */
  readonly name: string;
  /** 策略超参数 */
  readonly params: PolicyParams;

  /**
   * 基于当前游戏状态做出决策
   * @param state  当前游戏状态快照
   * @param playerId  当前决策玩家的 ID
   * @returns  决策动作
   */
  decide(state: GameState, playerId: PlayerId): Action;

  /**
   * 注入 PRNG（V2 仿真用，确保决策可复现）
   * 策略必须使用此 PRNG 替代 Math.random
   */
  setPRNG(prng: PRNG): void;
}
