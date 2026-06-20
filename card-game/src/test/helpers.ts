// 测试辅助函数

import type { Player, Card, CharacterId, PlayerId, EnergyCard } from '../types';
import { CHARACTERS } from '../game/characters';

// ============ 测试数据构建 ============

/**
 * 创建指定能量数的能量卡
 */
export function createEnergyCard(energy: number, isWild: boolean = false): EnergyCard {
  return {
    card_id: `energy_${energy}_${Math.random().toString(36).slice(2, 9)}`,
    name: isWild ? '万能能量' : `${energy}能量`,
    type: 'energy',
    energy,
    is_wild: isWild,
  };
}

/**
 * 创建特殊卡
 */
export function createSpecialCard(effectId: number, name: string = ''): Card {
  return {
    card_id: `special_${effectId}_${Math.random().toString(36).slice(2, 9)}`,
    name: name || `特殊卡${effectId}`,
    type: 'special',
    effect_id: effectId,
    description: '',
  };
}

// ============ 玩家状态构建 ============

/**
 * 创建测试用玩家
 */
export function createTestPlayer(
  id: PlayerId,
  name: string,
  characterId: CharacterId,
  options?: Partial<{
    hp: number;
    max_hp: number;
    shield: number;
    hand: Card[];
    marks: Array<{ name: string; remaining_turns: number }>;
    seatIndex: number;
    hasActedThisTurn: boolean;
    skillsUsedThisTurn: number;
    skillUsageCounts: number[];
    damageModifier: number;
    healModifier: number;
    penetrationModifier: number;
    nextTurnDamageModifier: number;
    nextTurnHealModifier: number;
    nextTurnPenetrationModifier: number;
    // v2.2.1.9 新增：跨回合生效的行动顺序修正（特殊卡 5「先手」测试）
    nextTurnActionOrderModifier: number;
    hasBlind: boolean;
    hasConfusion: boolean;
    hasSleep: boolean;
    hasMadness: boolean;
  }>
): Player {
  const char = CHARACTERS[characterId];
  return {
    id,
    name,
    type: 'human',
    seat_index: options?.seatIndex ?? 0,
    character_id: characterId,
    max_hp: options?.max_hp ?? char.hp,
    current_hp: options?.hp ?? char.hp,
    shield: options?.shield ?? 0,
    hand: options?.hand ?? [],
    marks: options?.marks ?? [],
    action_order_modifier: 0,
    damage_modifier: options?.damageModifier ?? 0,
    heal_modifier: options?.healModifier ?? 0,
    penetration_modifier: options?.penetrationModifier ?? 0,
    next_turn_damage_modifier: options?.nextTurnDamageModifier ?? 0,
    next_turn_heal_modifier: options?.nextTurnHealModifier ?? 0,
    next_turn_penetration_modifier: options?.nextTurnPenetrationModifier ?? 0,
    // v2.2.1.9 新增：跨回合行动顺序修正（默认 0，特殊卡 5「先手」测试时可覆盖）
    next_turn_action_order_modifier: options?.nextTurnActionOrderModifier ?? 0,
    took_damage_this_turn: false,
    has_acted_this_turn: options?.hasActedThisTurn ?? false,
    skills_used_this_turn: options?.skillsUsedThisTurn ?? 0,
    skill_usage_counts: options?.skillUsageCounts ?? [],
    remaining_exchanges: 0,
    phase1_cards: [],
    phase1_energy: 0,
    // 印记状态标志
    has_blind: options?.hasBlind ?? false,
    has_confusion: options?.hasConfusion ?? false,
    has_sleep: options?.hasSleep ?? false,
    has_madness: options?.hasMadness ?? false,
  };
}

// ============ 状态快照与比较 ============

/**
 * 玩家状态快照
 */
export interface PlayerSnapshot {
  hp: number;
  shield: number;
  handCount: number;
  marks: string[];
  damageMod: number;
  healMod: number;
  penMod: number;
  skillsUsed: number;
  hasActed: boolean;
}

/**
 * 拍摄玩家快照
 */
export function snapshotPlayer(player: Player): PlayerSnapshot {
  return {
    hp: player.current_hp,
    shield: player.shield,
    handCount: player.hand.length,
    marks: player.marks.map(m => m.name),
    damageMod: player.damage_modifier,
    healMod: player.heal_modifier,
    penMod: player.penetration_modifier,
    skillsUsed: player.skills_used_this_turn,
    hasActed: player.has_acted_this_turn,
  };
}

/**
 * 打印状态变化
 */
export function printStateDiff(
  playerName: string,
  before: PlayerSnapshot,
  after: PlayerSnapshot
): void {
  console.log('\n========================================');
  console.log(`📊 ${playerName} 状态变化`);
  console.log('========================================');

  const changes: string[] = [];

  if (before.hp !== after.hp) {
    changes.push(`  HP: ${before.hp} → ${after.hp} (${after.hp - before.hp >= 0 ? '+' : ''}${after.hp - before.hp})`);
  }
  if (before.shield !== after.shield) {
    changes.push(`  护盾: ${before.shield} → ${after.shield} (${after.shield - before.shield >= 0 ? '+' : ''}${after.shield - before.shield})`);
  }
  if (before.handCount !== after.handCount) {
    changes.push(`  手牌: ${before.handCount} → ${after.handCount} (${after.handCount - before.handCount >= 0 ? '+' : ''}${after.handCount - before.handCount})`);
  }
  if (before.marks.join(',') !== after.marks.join(',')) {
    changes.push(`  印记: [${before.marks.join(', ')}] → [${after.marks.join(', ')}]`);
  }
  if (before.damageMod !== after.damageMod) {
    changes.push(`  伤害加成: ${before.damageMod} → ${after.damageMod} (${after.damageMod - before.damageMod >= 0 ? '+' : ''}${after.damageMod - before.damageMod})`);
  }
  if (before.healMod !== after.healMod) {
    changes.push(`  回复加成: ${before.healMod} → ${after.healMod} (${after.healMod - before.healMod >= 0 ? '+' : ''}${after.healMod - before.healMod})`);
  }
  if (before.penMod !== after.penMod) {
    changes.push(`  穿透加成: ${before.penMod} → ${after.penMod} (${after.penMod - before.penMod >= 0 ? '+' : ''}${after.penMod - before.penMod})`);
  }
  if (before.skillsUsed !== after.skillsUsed) {
    changes.push(`  技能使用次数: ${before.skillsUsed} → ${after.skillsUsed}`);
  }

  if (changes.length === 0) {
    console.log('  (无变化)');
  } else {
    changes.forEach(c => console.log(c));
  }

  console.log('');
}

/**
 * 获取角色技能描述
 */
export function getSkillDescription(charId: CharacterId, skillIndex: number): string {
  const char = CHARACTERS[charId];
  if (!char || skillIndex >= char.skills.length) return '未知技能';
  return `${char.skills[skillIndex].name} (消耗${char.skills[skillIndex].cost}): ${char.skills[skillIndex].description}`;
}

/**
 * 获取目标状态摘要
 */
export function getTargetSummary(target: Player): string {
  return `${target.name}: HP=${target.current_hp}/${target.max_hp}, 护盾=${target.shield}, 手牌=${target.hand.length}, 印记=[${target.marks.map(m => m.name).join(',')}]`;
}

// ============ 详细状态展示函数 ============

/**
 * 显示单张卡的详细信息
 */
export function getCardDetail(card: Card): string {
  if (card.type === 'energy') {
    const ec = card as EnergyCard;
    return `${ec.name}(${ec.energy}能量${ec.is_wild ? ',万能' : ''})`;
  }
  return `${card.name}(特殊卡)`;
}

/**
 * 显示手牌详情
 */
export function getHandDetail(hand: Card[]): string {
  if (hand.length === 0) return '(无手牌)';
  return hand.map((c, i) => `${i}:${getCardDetail(c)}`).join(', ');
}

/**
 * 显示印记和状态详情
 */
export function getMarksAndStatesDetail(player: Player): string {
  const parts: string[] = [];

  // 印记
  if (player.marks.length > 0) {
    parts.push(...player.marks.map(m => `${m.name}(${m.remaining_turns}回合)`));
  }

  // 状态标志
  const states: string[] = [];
  if (player.has_blind) states.push('【失明】');
  if (player.has_confusion) states.push('【混乱】');
  if (player.has_sleep) states.push('【睡眠】');
  if (player.has_madness) states.push('【失神】');

  if (states.length > 0) {
    parts.push(...states);
  }

  return parts.length > 0 ? parts.join(', ') : '(无)';
}

/**
 * 显示加成详情
 */
export function getModifiersDetail(modifiers: {
  damage_modifier: number;
  heal_modifier: number;
  penetration_modifier: number;
  next_turn_damage_modifier: number;
  next_turn_heal_modifier: number;
  next_turn_penetration_modifier: number;
}): string {
  const parts: string[] = [];
  if (modifiers.damage_modifier !== 0) parts.push(`伤害+${modifiers.damage_modifier}`);
  if (modifiers.heal_modifier !== 0) parts.push(`回复+${modifiers.heal_modifier}`);
  if (modifiers.penetration_modifier !== 0) parts.push(`穿透+${modifiers.penetration_modifier}`);
  if (modifiers.next_turn_damage_modifier !== 0) parts.push(`下回合伤害+${modifiers.next_turn_damage_modifier}`);
  if (modifiers.next_turn_heal_modifier !== 0) parts.push(`下回合回复+${modifiers.next_turn_heal_modifier}`);
  if (modifiers.next_turn_penetration_modifier !== 0) parts.push(`下回合穿透+${modifiers.next_turn_penetration_modifier}`);
  return parts.length > 0 ? parts.join(', ') : '无';
}

/**
 * 显示玩家完整详情（单行格式，适合日志输出）
 */
export function showPlayerDetailCompact(player: Player, detailed: boolean = false): string {
  const lines: string[] = [];
  lines.push(`▸ ${player.name} [${player.character_id}]`);
  lines.push(`  HP: ${player.current_hp}/${player.max_hp} | 护盾: ${player.shield}`);
  lines.push(`  印记&状态: ${getMarksAndStatesDetail(player)}`);
  lines.push(`  本回合加成: ${getModifiersDetail(player)}`);

  return lines.join('\n');
}

/**
 * 打印双方状态对比（旧格式）
 */
export function printBothPlayersDetail(before: Player, after: Player, detailed: boolean = true): void {
  console.log('\n========================================');
  console.log('📊 双方状态变化');
  console.log('========================================');

  // 施法者
  console.log('\n【攻击方】');
  console.log(showPlayerDetailCompact(before));

  if (detailed) {
    console.log(`  释放前手牌: ${getHandDetail(before.hand)}`);
  }

  console.log('\n  ↓ 技能释放  ↓');

  // 目标
  console.log('\n【目标方】');
  console.log(showPlayerDetailCompact(after));

  if (detailed) {
    console.log(`  释放后手牌: ${getHandDetail(after.hand)}`);
  }

  console.log('');
}

/**
 * 打印技能释放前的状态（格式化表格）
 */
export function printBeforeSkill(
  attacker: Player,
  target: Player,
  skillName: string,
  paymentCards: Card[]
): void {
  console.log('\n┌' + '─'.repeat(60) + '┐');
  console.log('│ 🟢 技能释放前 - 攻击方                               ');
  console.log('├' + '─'.repeat(60) + '┤');
  console.log(`│ 角色: ${attacker.character_id.padEnd(20)} HP: ${attacker.current_hp}/${attacker.max_hp}`);
  console.log(`│ 护盾: ${attacker.shield}`.padEnd(50));
  console.log(`│ 印记&状态: ${getMarksAndStatesDetail(attacker)}`.padEnd(55));
  console.log(`│ 本回合加成: ${getModifiersDetail(attacker)}`.padEnd(55));
  console.log(`│ 手牌: ${getHandDetail(attacker.hand)}`.padEnd(60));

  console.log('├' + '─'.repeat(60) + '┤');
  console.log('│ 🔴 技能释放前 - 目标方                               ');
  console.log('├' + '─'.repeat(60) + '┤');
  console.log(`│ 角色: ${target.character_id.padEnd(20)} HP: ${target.current_hp}/${target.max_hp}`);
  console.log(`│ 护盾: ${target.shield}`.padEnd(50));
  console.log(`│ 印记&状态: ${getMarksAndStatesDetail(target)}`.padEnd(55));
  console.log(`│ 本回合加成: ${getModifiersDetail(target)}`.padEnd(55));
  console.log(`│ 手牌: ${getHandDetail(target.hand)}`.padEnd(60));

  console.log('├' + '─'.repeat(60) + '┤');
  console.log('│ ⚡ 技能消耗                                  ');
  console.log('├' + '─'.repeat(60) + '┤');
  console.log(`│ 技能: ${skillName}`.padEnd(55));
  console.log(`│ 消耗卡牌: ${paymentCards.map(c => getCardDetail(c)).join(', ')}`.padEnd(60));
  console.log('└' + '─'.repeat(60) + '┘');
}

/**
 * 打印技能释放后的状态（格式化表格）
 */
export function printAfterSkill(
  attacker: Player,
  target: Player,
  prevTargetHp: number,
  prevAttackerHp: number
): void {
  const targetHpDelta = prevTargetHp - target.current_hp;
  const attackerHpDelta = attacker.current_hp - prevAttackerHp;

  console.log('\n┌' + '─'.repeat(60) + '┐');
  console.log('│ 🟢 技能释放后 - 攻击方                               ');
  console.log('├' + '─'.repeat(60) + '┤');
  console.log(`│ 角色: ${attacker.character_id.padEnd(20)} HP: ${attacker.current_hp}/${attacker.max_hp}`);
  console.log(`│ 护盾: ${attacker.shield}`.padEnd(50));
  console.log(`│ 印记&状态: ${getMarksAndStatesDetail(attacker)}`.padEnd(55));
  console.log(`│ 本回合加成: ${getModifiersDetail(attacker)}`.padEnd(55));
  console.log(`│ 下回合加成: ${getModifiersDetail(attacker)}`.padEnd(55));
  console.log(`│ 手牌: ${getHandDetail(attacker.hand)}`.padEnd(60));

  console.log('├' + '─'.repeat(60) + '┤');
  console.log('│ 🔴 技能释放后 - 目标方                               ');
  console.log('├' + '─'.repeat(60) + '┤');
  console.log(`│ 角色: ${target.character_id.padEnd(20)} HP: ${target.current_hp}/${target.max_hp}`);
  console.log(`│ 护盾: ${target.shield}`.padEnd(50));
  console.log(`│ 印记&状态: ${getMarksAndStatesDetail(target)}`.padEnd(55));
  console.log(`│ 本回合加成: ${getModifiersDetail(target)}`.padEnd(55));
  console.log(`│ 手牌: ${getHandDetail(target.hand)}`.padEnd(60));

  console.log('├' + '─'.repeat(60) + '┤');
  console.log('│ 📊 HP变化                                       ');
  console.log('├' + '─'.repeat(60) + '┤');
  console.log(`│ 攻击者HP: ${prevAttackerHp} → ${attacker.current_hp} ${attackerHpDelta > 0 ? `(回复+${attackerHpDelta})` : attackerHpDelta < 0 ? `(${attackerHpDelta})` : '(无变化)'}`);
  console.log(`│ 目标HP:   ${prevTargetHp} → ${target.current_hp} ${targetHpDelta > 0 ? `(减少-${targetHpDelta})` : '(无变化)'}`);
  console.log('└' + '─'.repeat(60) + '┘');
}