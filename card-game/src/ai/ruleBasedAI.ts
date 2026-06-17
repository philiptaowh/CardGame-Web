// RuleBasedAI — 参数化规则AI策略族
// V2 仿真平台组件
//
// 实现 卡牌游戏2.0原型.md §2.2-§2.6 的决策树和评分函数
// 通过 θ 超参数区分不同行为风格

import type { GameState, PlayerId, Player, PRNG, Card, EnergyCard } from '../types';
import type { Action, IPlayerPolicy, PolicyParams } from './interfaces';
import { getCharacterById } from '../game/characters';
import { getMarkDefinition } from '../game/marks';

/**
 * RuleBasedAI — 参数化规则AI策略
 *
 * 核心为条件决策树 + 效用函数评分：
 * - 能量放置：S_place(e) 加权评分
 * - 技能选择：E[reward_k] 期望收益排序
 * - 目标选择：U_target 效用函数
 *
 * 每个实例绑定固定的 θ 参数，行为由 θ 决定。
 */

/** 特殊卡 effect_id → 附加印记名（用于"已有同名印记则不重复"判断） */
const SPECIAL_CARD_MARK_NAMES: Record<number, string> = {
  8: '治疗',
  9: '无垢',
  10: '庇佑',
  11: '鼓舞',
  12: '灵感',
};

export class RuleBasedAI implements IPlayerPolicy {
  readonly name: string;
  readonly params: PolicyParams;
  private prng: PRNG;

  /**
   * 本回合最近一次 decide() 输出的 action（用于"重复 cardIndex 检测"，
   * 防止 v2.1.1 修复前的 c0 死循环：AI 反复用同一张手牌第 1 张特殊卡）。
   * 跨回合自动重置（turn 变化时）。
   */
  private lastActionThisTurn: { turn: number; type: Action['type']; cardIndex?: number } | null = null;

  constructor(name: string, params: PolicyParams, prng?: PRNG) {
    this.name = name;
    this.params = params;
    this.prng = prng ?? Math.random;
  }

  setPRNG(prng: PRNG): void {
    this.prng = prng;
  }

  /** 记录本回合最近一次 action（用于重复动作检测） */
  private recordAction(state: GameState, action: Action): void {
    const cardIndex = (action.type === 'use_special_card' || action.type === 'place_energy')
      ? (action as { cardIndex: number }).cardIndex
      : undefined;
    this.lastActionThisTurn = { turn: state.turn, type: action.type, cardIndex };
  }

  // ==================== 主入口 ====================

  decide(state: GameState, playerId: PlayerId): Action {
    // 跨回合重置
    if (this.lastActionThisTurn && this.lastActionThisTurn.turn !== state.turn) {
      this.lastActionThisTurn = null;
    }

    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      const action: Action = { type: 'pass' };
      this.recordAction(state, action);
      return action;
    }

    // θ_noise 随机扰动：以 θ_noise 概率随机选择
    if (this.prng() < this.params.noise) {
      const action = this.randomValidAction(player, state);
      this.recordAction(state, action);
      return action;
    }

    let action: Action;
    switch (state.phase) {
      case 'card_exchange':
        action = this.decideExchange(player);
        break;
      case 'phase1':
        action = this.decidePhase1(player, state);
        break;
      case 'phase2':
        action = this.decidePhase2(player, state);
        break;
      default:
        action = { type: 'pass' };
    }
    this.recordAction(state, action);
    return action;
  }

  // ==================== 换牌决策 ====================

  private decideExchange(player: Player): Action {
    if (player.remaining_exchanges <= 0 || player.hand.length === 0) {
      return { type: 'pass' };
    }

    // 找出所有 <2能量的卡和特殊卡（特殊卡换牌收益较低）
    let targetIndex = -1;
    let minScore = Infinity;

    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      let score = 0; // 高 score = 想保留

      if (card.type === 'energy') {
        const ec = card as EnergyCard;
        if (ec.is_wild) {
          score = 3; // 万能能量卡保留价值高
        } else {
          score = ec.energy;
        }
      } else {
        score = 1; // 特殊卡保留价值低但非零
      }

      // 进攻型策略更倾向换掉低能量卡
      if (this.params.aggro > 0.6) {
        score -= 0.5; // 更积极地换牌
      }

      if (score < minScore) {
        minScore = score;
        targetIndex = i;
      }
    }

    // 只有评分低于阈值才换
    if (targetIndex !== -1 && minScore < 2) {
      return { type: 'exchange', cardIndex: targetIndex };
    }

    return { type: 'pass' };
  }

  // ==================== 能量放置决策（Phase 1）====================

  private decidePhase1(player: Player, _state: GameState): Action {
    const energyCards = player.hand
      .map((c, i) => ({ card: c, index: i }))
      .filter(item => item.card.type === 'energy');

    if (energyCards.length === 0) return { type: 'pass' };

    // 获取角色最大技能消耗
    const char = getCharacterById(player.character_id);
    const maxSkillCost = char ? Math.max(...char.skills.map(s => s.cost)) : 6;

    // S_place(e) 评分：θ_priority * (e/3) - (1-θ_priority) * min(e, maxCost)/maxCost
    let bestScore = -Infinity;
    let bestIndex = -1;

    for (const item of energyCards) {
      const ec = item.card as EnergyCard;
      let e: number;
      if (ec.is_wild) {
        // 万能能量按策略决定
        if (this.params.wild === 'keep') continue; // 跳过，保留给技能
        if (this.params.wild === 'place') { e = 1; } // 抢顺序时万能算1
        else { // bal — 动态决策
          const handEnergy = player.hand.reduce((s, c) =>
            s + (c.type === 'energy' ? ((c as EnergyCard).is_wild ? 6 : (c as EnergyCard).energy) : 0), 0);
          if (handEnergy >= maxSkillCost) { e = 1; } // 能量充裕可放置
          else continue; // 能量不足，保留
        }
      } else {
        e = ec.energy;
      }

      const priorityTerm = this.params.priority * (e / 3);
      const conserveTerm = (1 - this.params.priority) * (Math.min(e, maxSkillCost) / maxSkillCost);
      const score = priorityTerm - conserveTerm;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = item.index;
      }
    }

    // 关键修复：必须同时检查评分 > 0，否则 BO 优化的 priority 参数完全无效
    // BO 最优 priority < 0.333 的角色（char_2/3/7/8/9）评分全负 → 不放能量，留给 phase2 技能
    if (bestIndex !== -1 && bestScore > 0) {
      return { type: 'place_energy', cardIndex: bestIndex };
    }

    // 没有可放置的卡（如wild=keep且无其他能量卡）
    if (energyCards.length > 0) {
      // 放最低能量的卡保底
      let minEnergyIdx = energyCards[0].index;
      let minE = Infinity;
      for (const item of energyCards) {
        const ec = item.card as EnergyCard;
        if (!ec.is_wild && ec.energy < minE) {
          minE = ec.energy;
          minEnergyIdx = item.index;
        }
      }
      return { type: 'place_energy', cardIndex: minEnergyIdx };
    }

    return { type: 'pass' };
  }

  // ==================== 行动阶段决策（Phase 2）====================

  private decidePhase2(player: Player, state: GameState): Action {
    const char = getCharacterById(player.character_id);
    if (!char) return { type: 'pass' };

    let bestAction: Action | null = null;
    let bestScore = -Infinity;

    // --- 技能评分 ---
    for (let skillIndex = 0; skillIndex < char.skills.length; skillIndex++) {
      const skill = char.skills[skillIndex];

      // 检查使用次数上限
      const maxUses = skill.max_uses_per_turn ?? Infinity;
      if ((player.skill_usage_counts[skillIndex] || 0) >= maxUses) continue;

      // 检查能量支付可行性
      const payment = this.findPayment(player.hand, skill.cost);
      if (!payment) continue;

      // 目标选择
      if (skill.target === 'self') {
        const score = this.scoreSkill(skill, skillIndex, player, player, state);
        if (score > bestScore) {
          bestScore = score;
          bestAction = { type: 'use_skill', skillIndex, targetId: player.id, paymentCardIndices: payment };
        }
      } else {
        for (const target of state.players) {
          if (target.id === player.id) continue;
          const score = this.scoreSkill(skill, skillIndex, player, target, state);
          if (score > bestScore) {
            bestScore = score;
            bestAction = { type: 'use_skill', skillIndex, targetId: target.id, paymentCardIndices: payment };
          }
        }
      }
    }

    // --- 特殊卡评分 ---
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      if (card.type !== 'special') continue;

      let score = this.scoreSpecialCard(card.effect_id, player, state);

      // 重复 cardIndex 检测：与本回合上次 use_special_card 同 index → 强制 -100
      // 兜底防 c0 死循环（即使评分函数漏了某种无进展场景）
      if (
        this.lastActionThisTurn &&
        this.lastActionThisTurn.turn === state.turn &&
        this.lastActionThisTurn.type === 'use_special_card' &&
        this.lastActionThisTurn.cardIndex === i
      ) {
        score = -100;
      }

      if (score > bestScore) {
        bestScore = score;
        // 判断是否需要目标
        const needsTarget = [1, 3, 4, 14, 15, 16].includes(card.effect_id);
        if (needsTarget) {
          const target = this.pickTarget(player, state);
          if (target) {
            bestAction = { type: 'use_special_card', cardIndex: i, targetId: target.id };
          }
        } else {
          bestAction = { type: 'use_special_card', cardIndex: i };
        }
      }
    }

    return (bestAction && bestScore > 0) ? bestAction : { type: 'pass' };
  }

  // ==================== 技能评分 E[reward_k] ====================

  private scoreSkill(
    skill: { cost: number; name: string; description: string; target?: 'self' | 'other' },
    skillIndex: number,
    player: Player,
    target: Player,
    state: GameState,
  ): number {
    const hpRatio = player.current_hp / player.max_hp;
    const isDanger = hpRatio < this.params.hp_danger;

    // 基础分：θ_skill_pref 权重
    let score = this.params.skill_pref[skillIndex] * 10;

    // 根据技能费用估算价值（高费技能应有更高收益）
    score += skill.cost * 1.5;

    // ----- 启发式技能分类评分 -----

    // 1. 检测是否为回复/护盾类（self-target 且 cost>0 多为防御）
    if (skill.target === 'self') {
      if (isDanger) {
        score += 8; // 危险时倾向自保
      } else {
        score -= 2; // 安全时降低自保优先级
      }
    } else {
      // 攻击类技能
      score += this.params.aggro * 5;

      // 高进攻倾向时，低血量也攻击
      if (this.params.aggro > 0.7 && isDanger) {
        score += 3; // 激进策略：危险时仍进攻
      } else if (this.params.aggro < 0.3 && isDanger) {
        score -= 6; // 保守策略：危险时避免进攻
      }

      // 目标 HP 越低，补刀价值越高
      const targetHpRatio = target.current_hp / target.max_hp;
      if (targetHpRatio < 0.3) {
        score += 5; // 残血补刀
      }
    }

    // 3. 印记相关（根据技能名称或特性估算）
    if (skill.name.includes('印记') || skill.name.includes('中毒') ||
        skill.name.includes('诅咒') || skill.name.includes('流血')) {
      score += this.params.mark_weight * 3;
    }

    // 4. 基于目标印记的加成
    const negativeMarksOnTarget = target.marks.filter(m => {
      const def = getMarkDefinition(m.name);
      return def?.mark_type === 'negative';
    }).length;
    score += negativeMarksOnTarget * this.params.mark_weight * 1.5;

    return score;
  }

  // ==================== 特殊卡评分 ====================

  /**
   * 评分函数 v2.1.1：收紧"无进展"卡的分数。
   *
   * 修复 2026-06-08 人工审查发现的 P0 死循环：原版对 case 1/5/6/8-12/13/16
   * 在多数场景下返回正分，导致 AI 反复刷手牌第 1 张特殊卡（c0 占比 41-82%）。
   * 收紧策略：
   *   - case 1 安全时：-1 → -3（更明确不鼓励）
   *   - case 5 非紧急：3 → 1
   *   - case 6 手牌 >=5：4 → -2
   *   - case 8-12 已有同名印记：6/3 → -2
   *   - case 13 aggro<=0.4：aggro*4 → -1
   *   - case 16 封顶 7
   */
  private scoreSpecialCard(effectId: number, player: Player, _state: GameState): number {
    const hpRatio = player.current_hp / player.max_hp;
    const inDanger = isDanger(hpRatio, this.params.hp_danger);

    switch (effectId) {
      case 1: // 平分血量
        return inDanger ? 8 : -3;
      case 2: // 低血量回复+抽牌
        return hpRatio < 0.5 ? 8 + this.params.special_threshold * 5 : -2;
      case 3:
      case 4: // 抢牌/弃牌
        return this.params.aggro * 3;
      case 5: // 下回合先手
        return inDanger ? 3 : 1;
      case 6: // 抽2张
        return player.hand.length >= 5 ? -2 : 3;
      case 7: // 弃2抽4
        return player.hand.length >= 3 ? 5 : -3;
      case 8:
      case 9:
      case 10:
      case 11:
      case 12: { // 印记附加：已有同名印记则禁用
        const markName = SPECIAL_CARD_MARK_NAMES[effectId];
        const hasMark = markName
          ? player.marks.some(m => m.name === markName && m.remaining_turns > 0)
          : false;
        return hasMark ? -2 : 3;
      }
      case 13: // 全场流血（保守策略禁用）
        return this.params.aggro > 0.4 ? this.params.aggro * 4 : -1;
      case 14: // 回复+中毒
        return inDanger ? 7 : 4;
      case 15: // 诅咒
        return this.params.mark_weight * 2;
      case 16: // 回合数伤害（封顶防爆）
        return Math.min(3 + _state.turn * 0.5, 7);
      default:
        return 0;
    }
  }

  // ==================== 目标选择 U_target ====================

  private pickTarget(player: Player, state: GameState): Player | null {
    const others = state.players.filter(p => p.id !== player.id);
    if (others.length === 0) return null;

    let bestTarget: Player | null = null;
    let bestScore = -Infinity;

    for (const target of others) {
      const score = this.targetUtility(player, target);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    return bestTarget;
  }

  /**
   * U_target(p_i, p_j) = α_aggro · D(p_j) + (1-α_aggro) · V(p_j) + β · M(p_j)
   *
   * D = 血量缺失程度
   * V = 威胁度（技能消耗总和估算）
   * M = 负面印记密度
   */
  private targetUtility(player: Player, target: Player): number {
    const D = 1 - target.current_hp / target.max_hp;

    // V：威胁度估算 — 按对手手牌能量估算
    const threatEnergy = target.hand.reduce((sum, card) => {
      if (card.type === 'energy') {
        const ec = card as EnergyCard;
        return sum + (ec.is_wild ? 6 : ec.energy);
      }
      return sum + 1; // 特殊卡也算1点潜在威胁
    }, 0);
    const V = Math.min(threatEnergy / 10, 1);

    // M：负面印记密度
    const negativeMarks = target.marks.filter(m => {
      const def = getMarkDefinition(m.name);
      return def?.mark_type === 'negative';
    });
    const M = negativeMarks.reduce((sum, m) => sum + m.remaining_turns, 0) / 3;

    return this.params.aggro * D + (1 - this.params.aggro) * V + this.params.mark_weight * M;
  }

  // ==================== 能量支付选择 ====================

  /** 从手牌中选择能量卡支付技能费用，返回支付卡索引数组（从大到小） */
  private findPayment(hand: Card[], cost: number): number[] | null {
    // 收集所有能量卡索引
    const energyCards: Array<{ index: number; value: number; isWild: boolean }> = [];

    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      if (card.type === 'energy') {
        const ec = card as EnergyCard;
        energyCards.push({
          index: i,
          value: ec.is_wild ? 6 : ec.energy,
          isWild: ec.is_wild,
        });
      }
    }

    // 按能量值从大到小排序（优先用大能量卡减少手牌消耗）
    energyCards.sort((a, b) => b.value - a.value);

    let paid = 0;
    const used: number[] = [];

    // 先用非万能能量卡
    for (const ec of energyCards) {
      if (!ec.isWild && paid < cost) {
        paid += ec.value;
        used.push(ec.index);
      }
    }

    // 非万能不够时用万能
    for (const ec of energyCards) {
      if (ec.isWild && paid < cost) {
        const gap = cost - paid;
        paid += Math.min(6, Math.max(1, gap));
        used.push(ec.index);
      }
    }

    if (paid < cost) return null;

    // 返回从大到小的索引（方便引擎从后往前 splice）
    return used.sort((a, b) => b - a);
  }

  // ==================== 随机扰动 ====================

  /** 生成一个当前阶段的随机有效动作（用于 θ_noise 扰动） */
  private randomValidAction(player: Player, state: GameState): Action {
    const options: Action[] = [{ type: 'pass' }];

    if (state.phase === 'card_exchange' && player.remaining_exchanges > 0) {
      for (let i = 0; i < player.hand.length; i++) {
        options.push({ type: 'exchange', cardIndex: i });
      }
    }

    if (state.phase === 'phase1') {
      for (let i = 0; i < player.hand.length; i++) {
        if (player.hand[i].type === 'energy') {
          options.push({ type: 'place_energy', cardIndex: i });
        }
      }
    }

    if (state.phase === 'phase2') {
      const char = getCharacterById(player.character_id);
      if (char) {
        for (let si = 0; si < char.skills.length; si++) {
          const payment = this.findPayment(player.hand, char.skills[si].cost);
          if (payment) {
            if (char.skills[si].target === 'self') {
              options.push({ type: 'use_skill', skillIndex: si, targetId: player.id, paymentCardIndices: payment });
            } else {
              for (const p of state.players) {
                if (p.id !== player.id) {
                  options.push({ type: 'use_skill', skillIndex: si, targetId: p.id, paymentCardIndices: payment });
                }
              }
            }
          }
        }
      }
      for (let i = 0; i < player.hand.length; i++) {
        if (player.hand[i].type === 'special') {
          const needsTarget = [1, 3, 4, 14, 15, 16].includes((player.hand[i] as any).effect_id);
          if (needsTarget) {
            for (const p of state.players) {
              if (p.id !== player.id) {
                options.push({ type: 'use_special_card', cardIndex: i, targetId: p.id });
              }
            }
          } else {
            options.push({ type: 'use_special_card', cardIndex: i });
          }
        }
      }
    }

    return options[Math.floor(this.prng() * options.length)];
  }
}

// ==================== 工具函数 ====================

function isDanger(hpRatio: number, threshold: number): boolean {
  return hpRatio < threshold;
}
