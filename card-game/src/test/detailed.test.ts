// 详细技能测试 - 针对特定技能的深度测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import {
  createTestPlayer,
  createEnergyCard,
  getSkillDescription,
  getCardDetail,
  getHandDetail,
  getMarksAndStatesDetail,
  getModifiersDetail,
  showPlayerDetailCompact,
  printBothPlayersDetail,
  printBeforeSkill,
  printAfterSkill
} from './helpers';

// 详细测试模板
function runDetailedSkillTest(config: {
  name: string;                    // 测试名称
  attackerChar: string;            // 攻击方角色ID
  defenderChar: string;          // 防御方角色ID
  skillIndex: number;          // 技能索引
  defenderShield?: number;       // 防御方初始护盾
  attackerHand?: number[];    // 攻击方手牌能量
  defenderHand?: number[];     // 防御方手牌能量
  defenderMarks?: Array<{name: string; remaining_turns: number}>; // 防御方印记
  attackerStates?: {        // 攻击方状态
    blind?: boolean;
    confusion?: boolean;
    sleep?: boolean;
    madness?: boolean;
  };
  defenderStates?: {       // 防御方状态
    blind?: boolean;
    confusion?: boolean;
    sleep?: boolean;
    madness?: boolean;
  };
  turn: number;            // 当前回合
  descriptionPRD: string;    // PRD描述
  expected?: {            // 预期结果（用于人工确认）
    damage?: number;
    penetration?: number;
    heal?: number;
    shield?: number;
  };
}) {
  return it(config.name, () => {
    // 重置商店
    useGameStore.setState({
      gameState: {
        turn: config.turn,
        gameMode: '1v1',
        phase1_results: null,
        phase: 'phase2',
        players: [],
        current_player_index: 0,
        action_order: ['player_1', 'player_2'],
        deck: [],
        discard_pile: [],
        logs: [],
        winner: null,
      },
    });

    // 创建攻击方
    const attHand = config.attackerHand
      ? config.attackerHand.map(e => createEnergyCard(e))
      : [createEnergyCard(1)];
    const attacker = createTestPlayer('player_1', '攻击者', config.attackerChar, {
      hand: attHand,
      hasBlind: config.attackerStates?.blind,
      hasConfusion: config.attackerStates?.confusion,
      hasSleep: config.attackerStates?.sleep,
      hasMadness: config.attackerStates?.madness,
    });

    // 创建防御方
    const defHand = config.defenderHand
      ? config.defenderHand.map(e => createEnergyCard(e))
      : [];
    const defender = createTestPlayer('player_2', '防御者', config.defenderChar, {
      hand: defHand,
      shield: config.defenderShield ?? 0,
      marks: config.defenderMarks ?? [],
      hasBlind: config.defenderStates?.blind,
      hasConfusion: config.defenderStates?.confusion,
      hasSleep: config.defenderStates?.sleep,
      hasMadness: config.defenderStates?.madness,
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [attacker, defender],
      },
    });

    // 打印测试头
    console.log('\n' + '='.repeat(50));
    console.log(`🧪 ${config.name}`);
    console.log('='.repeat(50));
    console.log(`📜 PRD描述: ${config.descriptionPRD}`);
    console.log(`🎯 技能: ${getSkillDescription(config.attackerChar, config.skillIndex)}`);

    // 打印技能释放前状态
    printBeforeSkill(attacker, defender, getSkillDescription(config.attackerChar, config.skillIndex), attacker.hand);

    // 保存释放前的HP用于比较
    const prevAttackerHp = attacker.current_hp;
    const prevTargetHp = defender.current_hp;

    // 执行技能
    useGameStore.getState().useSkill('player_1', config.skillIndex, 'player_2', [0]);

    // 获取释放后状态
    const afterAttacker = useGameStore.getState().gameState.players[0];
    const afterDefender = useGameStore.getState().gameState.players[1];

    // 打印技能释放后状态
    printAfterSkill(afterAttacker, afterDefender, prevTargetHp, prevAttackerHp);

    // TODO: 添加断言（可选）
    // expect(afterDefender.current_hp).toBe(expectedHp);
  });
}

// 主要技能测试
describe('详细技能测试 - 核心角色', () => {
  // 角色4-强化 技能1
  runDetailedSkillTest({
    name: '角色4-强化 技能1: 增伤',
    attackerChar: 'char_4',
    defenderChar: 'char_1',
    skillIndex: 0,
    attackerHand: [1],
    turn: 2,
    descriptionPRD: '指定一位其他玩家，使其受到1点伤害，然后自己下一回合所有伤害增加3',
    expected: { damage: 1 },
  });

  // 角色4-强化 技能2
  runDetailedSkillTest({
    name: '角色4-强化 技能2: 治疗加成',
    attackerChar: 'char_4',
    defenderChar: 'char_1',
    skillIndex: 1,
    attackerHand: [1],
    turn: 2,
    descriptionPRD: '指定一位其他玩家，使其受到0点伤害，自己下一回合所有回复增加2',
  });

  // 角色4-强化 技能3
  runDetailedSkillTest({
    name: '角色4-强化 技能3: 双重强化',
    attackerChar: 'char_4',
    defenderChar: 'char_1',
    skillIndex: 2,
    attackerHand: [3],
    turn: 2,
    descriptionPRD: '指定一位其他玩家，使其受到3点伤害，回复自己3点血量，下回合伤害+3, 回复+3',
  });

  // 有护盾时的伤害测试
  runDetailedSkillTest({
    name: '角色4-强化 技能1: 有护盾时的伤害',
    attackerChar: 'char_4',
    defenderChar: 'char_1',
    skillIndex: 0,
    attackerHand: [1],
    defenderShield: 5,
    turn: 2,
    descriptionPRD: '有护盾时，伤害先抵消护盾',
  });

  // 有印记时的测试
  runDetailedSkillTest({
    name: '角色6-持久 技能2: 目标有中毒',
    attackerChar: 'char_6',
    defenderChar: 'char_1',
    skillIndex: 1,
    attackerHand: [2],
    defenderMarks: [{ name: '中毒', remaining_turns: 1 }],
    turn: 2,
    descriptionPRD: '目标有中毒印记时，使其受到3点穿透',
  });
});