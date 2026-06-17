// 能量卡和特殊卡数据定义

import type { EnergyCard, SpecialCard, Card } from '../types';

// ============ 能量卡定义 ============

// 1能量卡 x58
const ENERGY_1_CARDS: EnergyCard[] = Array.from({ length: 58 }, (_, i) => ({
  card_id: `energy_1_${i + 1}`,
  name: '1能量',
  type: 'energy',
  energy: 1,
  is_wild: false,
}));

// 2能量卡 x43
const ENERGY_2_CARDS: EnergyCard[] = Array.from({ length: 43 }, (_, i) => ({
  card_id: `energy_2_${i + 1}`,
  name: '2能量',
  type: 'energy',
  energy: 2,
  is_wild: false,
}));

// 3能量卡 x22
const ENERGY_3_CARDS: EnergyCard[] = Array.from({ length: 22 }, (_, i) => ({
  card_id: `energy_3_${i + 1}`,
  name: '3能量',
  type: 'energy',
  energy: 3,
  is_wild: false,
}));

// 万能能量卡 x7
const WILD_ENERGY_CARDS: EnergyCard[] = Array.from({ length: 7 }, (_, i) => ({
  card_id: `wild_energy_${i + 1}`,
  name: '万能能量',
  type: 'energy',
  energy: 1,
  is_wild: true,
}));

export const ENERGY_CARDS: EnergyCard[] = [
  ...ENERGY_1_CARDS,
  ...ENERGY_2_CARDS,
  ...ENERGY_3_CARDS,
  ...WILD_ENERGY_CARDS,
];

// ============ 特殊卡定义 ============

export const SPECIAL_CARDS: SpecialCard[] = [
  // 特殊卡1: 平分血量
  {
    card_id: 'special_1',
    name: '平分',
    type: 'special',
    effect_id: 1,
    description: '指定一位其他玩家，平分双方的当前血量',
  },
  // 特殊卡2: 危急回复
  {
    card_id: 'special_2',
    name: '危急',
    type: 'special',
    effect_id: 2,
    description: '当血量低于一半时，使用此卡，回复自己四分之一最大血量；当血量低于一半时，使用此卡，自己再从卡组抽2张卡',
  },
  // 特殊卡3: 盗取手牌
  {
    card_id: 'special_3',
    name: '盗取',
    type: 'special',
    effect_id: 3,
    description: '指定一位其他玩家，获得ta的1张手卡',
  },
  // 特殊卡4: 弃置手牌
  {
    card_id: 'special_4',
    name: '破坏',
    type: 'special',
    effect_id: 4,
    description: '指定一位其他玩家，令ta弃置2张手牌',
  },
  // 特殊卡5: 换先手
  {
    card_id: 'special_5',
    name: '先手',
    type: 'special',
    effect_id: 5,
    description: '自己弃置1张手卡，使用此卡，下一回合自己第一个行动',
  },
  // 特殊卡6: 抽牌
  {
    card_id: 'special_6',
    name: '抽牌',
    type: 'special',
    effect_id: 6,
    description: '自己从卡组抽2张卡',
  },
  // 特殊卡7: 大抽牌
  {
    card_id: 'special_7',
    name: '大抽',
    type: 'special',
    effect_id: 7,
    description: '自己弃置2张手卡，使用此卡，自己从卡组中抽4张卡',
  },
  // 特殊卡8: 治疗印记
  {
    card_id: 'special_8',
    name: '治疗',
    type: 'special',
    effect_id: 8,
    description: '为自己附加"治疗"印记4回合',
  },
  // 特殊卡9: 无垢印记
  {
    card_id: 'special_9',
    name: '无垢',
    type: 'special',
    effect_id: 9,
    description: '为自己附加"无垢"印记2回合',
  },
  // 特殊卡10: 庇佑印记
  {
    card_id: 'special_10',
    name: '庇佑',
    type: 'special',
    effect_id: 10,
    description: '为自己附加"庇佑"印记4回合',
  },
  // 特殊卡11: 鼓舞印记
  {
    card_id: 'special_11',
    name: '鼓舞',
    type: 'special',
    effect_id: 11,
    description: '为自己附加"鼓舞"印记3回合',
  },
  // 特殊卡12: 灵感印记
  {
    card_id: 'special_12',
    name: '灵感',
    type: 'special',
    effect_id: 12,
    description: '为自己附加"灵感"印记2回合',
  },
  // 特殊卡13: 流血印记
  {
    card_id: 'special_13',
    name: '流血',
    type: 'special',
    effect_id: 13,
    description: '对除了自己外的全场玩家附加"流血"印记2回合',
  },
  // 特殊卡14: 中毒
  {
    card_id: 'special_14',
    name: '剧毒',
    type: 'special',
    effect_id: 14,
    description: '回复自己3点血量，指定一位其他玩家，附加"中毒"印记3回合',
  },
  // 特殊卡15: 诅咒
  {
    card_id: 'special_15',
    name: '诅咒',
    type: 'special',
    effect_id: 15,
    description: '指定一位其他玩家，附加"诅咒"印记1回合',
  },
  // 特殊卡16: 回合伤害
  {
    card_id: 'special_16',
    name: '终局',
    type: 'special',
    effect_id: 16,
    description: '指定一位其他玩家，使其受到当前回合数点伤害和穿透',
  },
];

// ============ 卡组创建 ============

export function createDeck(): Card[] {
  // 简化：从所有能量卡和特殊卡创建卡组
  return [...ENERGY_CARDS, ...SPECIAL_CARDS];
}
export function getEnergyCards(): EnergyCard[] {
  return ENERGY_CARDS;
}

export function getSpecialCards(): SpecialCard[] {
  return SPECIAL_CARDS;
}