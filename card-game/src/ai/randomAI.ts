// RandomAI — 纯随机决策基线
// V2 仿真平台组件

import type { GameState, PlayerId, PRNG, Card } from '../types';
import type { Action, IPlayerPolicy, PolicyParams } from './interfaces';
import { getCharacterById } from '../game/characters';

/**
 * RandomAI — 纯随机决策策略
 *
 * 作为胜率基线（baseline）使用。
 * 所有决策完全随机，不包含任何启发式逻辑。
 * 用于评估规则AI策略在多大程度上优于"瞎蒙"。
 */
export class RandomAI implements IPlayerPolicy {
  readonly name: string;
  readonly params: PolicyParams;
  private prng: PRNG;

  constructor(name?: string, prng?: PRNG) {
    this.name = name ?? 'RandomAI';
    this.params = {
      priority: 0.5, wild: 'bal', hp_danger: 0.35, aggro: 0.5,
      mark_weight: 1.0, skill_pref: [0.25, 0.25, 0.25, 0.25],
      special_threshold: 0.5, noise: 1.0, // noise=1 → 始终随机
    };
    this.prng = prng ?? Math.random;
  }

  setPRNG(prng: PRNG): void {
    this.prng = prng;
  }

  decide(state: GameState, playerId: PlayerId): Action {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { type: 'pass' };

    switch (state.phase) {
      case 'card_exchange':
        return this.randomExchange(player);
      case 'phase1':
        return this.randomPhase1(player);
      case 'phase2':
        return this.randomPhase2(player, state);
      default:
        return { type: 'pass' };
    }
  }

  private randomExchange(player: GameState['players'][0]): Action {
    if (player.remaining_exchanges <= 0 || player.hand.length === 0) {
      return { type: 'pass' };
    }
    // 50% 概率换牌
    if (this.prng() < 0.5) {
      const idx = Math.floor(this.prng() * player.hand.length);
      return { type: 'exchange', cardIndex: idx };
    }
    return { type: 'pass' };
  }

  private randomPhase1(player: GameState['players'][0]): Action {
    const energyCards = player.hand
      .map((c, i) => ({ c, i }))
      .filter(item => item.c.type === 'energy');

    if (energyCards.length === 0) return { type: 'pass' };

    // 50% 概率放 1 张能量卡
    if (this.prng() < 0.5) {
      const pick = energyCards[Math.floor(this.prng() * energyCards.length)];
      return { type: 'place_energy', cardIndex: pick.i };
    }
    return { type: 'pass' };
  }

  private randomPhase2(player: GameState['players'][0], state: GameState): Action {
    const char = getCharacterById(player.character_id);
    if (!char) return { type: 'pass' };

    // 收集可用选项
    const options: Action[] = [{ type: 'pass' }];

    // 所有技能（可支付能量则使用）
    char.skills.forEach((skill, skillIndex) => {
      const maxUses = skill.max_uses_per_turn ?? Infinity;
      if ((player.skill_usage_counts[skillIndex] || 0) >= maxUses) return;

      // 检查是否有足够能量
      const totalEnergy = player.hand.reduce((sum, card) => {
        if (card.type === 'energy') {
          return sum + (card.is_wild ? 6 : card.energy);
        }
        return sum;
      }, 0);
      if (totalEnergy < skill.cost) return;

      // 选择目标
      if (skill.target === 'self') {
        const payment = this.payEnergy(player.hand, skill.cost);
        if (payment) options.push({ type: 'use_skill', skillIndex, targetId: player.id, paymentCardIndices: payment });
      } else {
        const others = state.players.filter(p => p.id !== player.id);
        const payment = this.payEnergy(player.hand, skill.cost);
        if (payment && others.length > 0) {
          const target = others[Math.floor(this.prng() * others.length)];
          options.push({ type: 'use_skill', skillIndex, targetId: target.id, paymentCardIndices: payment });
        }
      }
    });

    // 特殊卡
    player.hand.forEach((card, i) => {
      if (card.type === 'special') {
        if (card.effect_id >= 1 && card.effect_id <= 5 && card.effect_id !== 2) {
          // 需要目标的特殊卡
          const others = state.players.filter(p => p.id !== player.id);
          if (others.length > 0) {
            const target = others[Math.floor(this.prng() * others.length)];
            options.push({ type: 'use_special_card', cardIndex: i, targetId: target.id });
          }
        } else {
          options.push({ type: 'use_special_card', cardIndex: i });
        }
      }
    });

    return options[Math.floor(this.prng() * options.length)];
  }

  /** 简化能量支付选择：收集前 N 张能量卡满足费用 */
  private payEnergy(hand: Card[], cost: number): number[] | null {
    const energyIndices = hand
      .map((c, i) => ({ c, i }))
      .filter(item => item.c.type === 'energy')
      .sort((a, b) => (b.c as any).energy - (a.c as any).energy); // 优先用大能量卡

    let paid = 0;
    const indices: number[] = [];
    for (const item of energyIndices) {
      if (paid >= cost) break;
      const ec = item.c as any;
      indices.push(item.i);
      paid += ec.is_wild ? Math.min(6, cost - paid) : ec.energy;
    }
    return paid >= cost ? indices.sort((a, b) => b - a) : null;
  }
}
