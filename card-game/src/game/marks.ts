// 印记系统：效果定义

export type MarkType = 'positive' | 'negative';

export interface MarkDefinition {
  name: string;
  mark_type: MarkType;
  duration: number;
  description: string;
}

// ============ 印记定义 ============

export const MARKS: Record<string, MarkDefinition> = {
  // 正面印记
  治疗: { name: '治疗', mark_type: 'positive', duration: 1, description: '回复自己4点血量' },
  无垢: { name: '无垢', mark_type: 'positive', duration: 1, description: '使自己的所有负面效果的印记失效' },
  庇佑: { name: '庇佑', mark_type: 'positive', duration: 1, description: '自己获得4点护盾' },
  鼓舞: { name: '鼓舞', mark_type: 'positive', duration: 1, description: '下一个回合中自己的所有攻击，若有伤害则增加2' },
  灵感: { name: '灵感', mark_type: 'positive', duration: 1, description: '从卡组中抽1张卡' },
  // 负面印记
  失明: { name: '失明', mark_type: 'negative', duration: 1, description: '下一个回合中自己行动开始时无法从卡组中抽卡' },
  睡眠: { name: '睡眠', mark_type: 'negative', duration: 1, description: '回复自己2点血量，下一个回合自己无法行动' },
  混乱: { name: '混乱', mark_type: 'negative', duration: 1, description: '下一个回合中，自己选定攻击目标和特殊卡的目标时，实际的目标为选中目标的序号+1' },
  失神: { name: '失神', mark_type: 'negative', duration: 1, description: '下一个回合自己每次使用技能都需要额外将1张手卡放入弃牌区' },
  弱化: { name: '弱化', mark_type: 'negative', duration: 1, description: '下一个回合中自己的所有攻击，若有伤害则减少2' },
  流血: { name: '流血', mark_type: 'negative', duration: 1, description: '自己受到4点伤害' },
  中毒: { name: '中毒', mark_type: 'negative', duration: 1, description: '自己受到2点伤害' },
  诅咒: { name: '诅咒', mark_type: 'negative', duration: 1, description: '自己受到4点穿透' },
};

export function getMarkDefinition(name: string): MarkDefinition | undefined {
  return MARKS[name];
}

export function getAllMarks(): MarkDefinition[] {
  return Object.values(MARKS);
}