// 9个角色卡数据定义

import type { CharacterCard, CharacterId } from '../types';

export const CHARACTERS: Record<CharacterId, CharacterCard> = {
  // 角色1: 平衡
  char_1: {
    card_id: 'char_1',
    name: '平衡',
    hp: 100,
    skills: [
      { name: '攻击', cost: 1, description: '指定一位其他玩家，使其受到3点伤害' },
      { name: '回复', cost: 2, description: '回复自己4点血量', target: 'self' },
      { name: '强化', cost: 3, description: '为自己附加"无垢"和"灵感"印记2回合', target: 'self' },
      { name: '抽牌攻击', cost: 4, description: '指定一位其他玩家，使其受到8点伤害和4点穿透，然后自己从卡组中抽1张卡' },
    ],
  },

  // 角色2: 防御
  char_2: {
    card_id: 'char_2',
    name: '防御',
    hp: 135,
    skills: [
      { name: '护盾', cost: 1, description: '指定一位其他玩家，使其受到1点伤害，然后自己获得2点护盾' },
      { name: '铁壁', cost: 2, description: '自己获得6点护盾', target: 'self' },
      { name: '庇佑', cost: 2, description: '为自己附加"庇佑"印记3回合', target: 'self' },
      { name: '猛攻', cost: 6, description: '指定一位其他玩家，使其受到12点伤害，然后自己回复当前护盾数值一半（向下取整）的血量，若指定的玩家手牌小于等于2，则使其受到12点穿透' },
    ],
  },

  // 角色3: 进攻
  char_3: {
    card_id: 'char_3',
    name: '进攻',
    hp: 80,
    skills: [
      { name: '斩击', cost: 1, description: '指定一位其他玩家，使其受到3点伤害' },
      { name: '穿刺', cost: 2, description: '指定一位其他玩家，使其受到4点伤害和2点穿透' },
      { name: '猛砍', cost: 3, description: '指定一位其他玩家，使其受到6点伤害，然后自己从卡组中抽1张卡' },
      { name: '毁灭', cost: 6, description: '指定一位其他玩家，使其受到12点伤害和6点穿透，然后若指定的玩家当前血量大于自己当前血量，则再使其受到18点穿透' },
    ],
  },

  // 角色4: 强化
  char_4: {
    card_id: 'char_4',
    name: '强化',
    hp: 110,
    skills: [
      { name: '增伤', cost: 1, description: '指定一位其他玩家，使其受到1点伤害，然后自己下一回合所有伤害增加3' },
      { name: '治疗加成', cost: 1, description: '指定一位其他玩家，使其受到0点伤害，回复自己0点血量，然后自己下一回合所有回复增加2' },
      { name: '双重强化', cost: 3, description: '指定一位其他玩家，使其受到3点伤害，回复自己3点血量，然后自己下一回合所有伤害增加3，所有回复增加3' },
      { name: '终极强化', cost: 6, description: '指定一位其他玩家，使其受到0点伤害，然后自己下一回合所有伤害增加6，并从卡组中抽1张卡' },
    ],
  },

  // 角色5: 先手
  char_5: {
    card_id: 'char_5',
    name: '先手',
    hp: 90,
    skills: [
      { name: '先攻', cost: 1, description: '指定一位其他玩家，使其受到2点伤害，然后若该玩家还未行动则使其再受到2点伤害' },
      { name: '抢先', cost: 2, description: '指定一位其他玩家，使其受到2点伤害，然后若该玩家还未行动，则自己从卡组中抽1张卡，同一回合内此技能最多使用3次', max_uses_per_turn: 3 },
      // v2.2.1.8 平衡调整：附加 2 正 1 负印记（鼓舞 + 灵感 + 流血）各 1 回合
      { name: '突袭', cost: 3, description: '指定一位其他玩家，使其受到3点伤害和3点穿透，然后若该玩家还未行动，则为自己附加"鼓舞"、"灵感"和"流血"印记各1回合' },
      { name: '致盲', cost: 6, description: '指定一位其他玩家，附加"失明"印记1回合，然后若该玩家已经行动，则额外附加"睡眠"印记1回合，且自己下一回合所有���害增加2' },
    ],
  },

  // 角色6: 持久
  char_6: {
    card_id: 'char_6',
    name: '持久',
    hp: 115,
    skills: [
      { name: '毒刃', cost: 1, description: '指定一位其他玩家，使其受到1点穿透，然后回复自己2点血量' },
      { name: '剧毒', cost: 2, description: '指定一位其他玩家，附加"中毒"印记1回合，然后回复自己2点血量，若该玩家已拥有"中毒"印记，则使其受到3点穿透' },
      { name: '诅咒', cost: 3, description: '指定一位其他玩家，附加"诅咒"印记3回合，然后为自己附加"治疗"印记3回合' },
      { name: '衰败', cost: 6, description: '指定一位其他玩家，附加"流血"印记3回合，然后当回合数大于12时，使指定的玩家受到当前回合数一半加6的穿透，并回复自己当前回合数一半的血量' },
    ],
  },

  // 角色7: 弱化 (v2.2.1 完全重做 — 弱化 stacking 流)
  char_7: {
    card_id: 'char_7',
    name: '弱化',
    hp: 80,
    skills: [
      { name: '削弱', cost: 1, description: '指定一位其他玩家，使其受到2点伤害并附加"弱化"印记1回合' },
      // v2.2.1.6 修复判定顺序后文案同步：先判定再分支，避免歧义
      { name: '衰弱', cost: 2, description: '指定一位其他玩家，若其没有"弱化"印记则附加"弱化"印记2回合；若其已有"弱化"印记，则为自己附加"治疗"印记2回合' },
      { name: '虚弱', cost: 3, description: '指定一位其他玩家，若其没有"弱化"印记则附加"弱化"印记2回合；若其已有"弱化"印记，则附加"失明"和"失神"印记1回合' },
      { name: '朽灭', cost: 6, description: '指定一位其他玩家，使其受到6点伤害，若当前回合数大于8，则使该玩家受到弱化角色当前血量十分之一（向下取整）的伤害和穿透' },
    ],
  },

  // 角色8: 反击 (v2.2.1 技能4 重做 — 条件翻转 + 自损机制)
  char_8: {
    card_id: 'char_8',
    name: '反击',
    hp: 105,
    skills: [
      { name: '反伤', cost: 1, description: '指定一位其他玩家，使其受到2点伤害，然后若本回合自己受到过伤害，则使其再受到2点伤害' },
      { name: '反击', cost: 2, description: '指定一位其他玩家，使其受到4点伤害，然后若本回合自己受到过伤害，则回复自己4点血量' },
      { name: '反咒', cost: 3, description: '指定一位其他玩家，使其受到6点伤害，然后若本回合自己受到过伤害，则令指定的玩家附加"诅咒"印记1回合' },
      { name: '反叛', cost: 6, description: '指定一位其他玩家，使其受到6点伤害和6点穿透，然后若本回合自己未受到过伤害，则令自己和指定的玩家受到4点伤害' },
    ],
  },

  // 角色9: 连击
  char_9: {
    card_id: 'char_9',
    name: '连击',
    hp: 90,
    skills: [
      { name: '连斩', cost: 1, description: '指定一位其他玩家，使其受到2点伤害和1点穿透' },
      { name: 'Combo', cost: 2, description: '自己下一回合所有伤害增加2，所有穿透增加2，所有回复增加1', target: 'self' },
      { name: '抽牌', cost: 2, description: '指定一位其他玩家，使其受到0点伤害，然后回复自己0点血量并从卡组中抽1张卡' },
      { name: '狂怒', cost: 6, description: '指定一位其他玩家，使其受到本回合自己已经使用技能的次数2倍的穿透，然后若本回合自己使用技能的次数小于等于3，则为自己附加"无垢"和"灵感"印记1回合' },
    ],
  },
};

export function getAllCharacters(): CharacterCard[] {
  return Object.values(CHARACTERS);
}

export function getCharacterById(id: string): CharacterCard | undefined {
  return CHARACTERS[id as CharacterId];
}