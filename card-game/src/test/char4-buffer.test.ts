// 角色4-强化 技能测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, getSkillDescription, getTargetSummary } from './helpers';

describe('角色4-强化 技能测试', () => {
  const resetStore = () => {
    useGameStore.setState({
      gameState: {
        turn: 1,
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
  };

  // ============ 技能1: 增伤 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到1点伤害，然后自己下一回合所有伤害增加3
  it('技能1 - 增伤: 造成1点伤害，下回合伤害+3', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_4', {
      hp: 110,
      hand: [createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色4-强化 技能1 - 增伤');
    console.log('技能描述:', getSkillDescription('char_4', 0));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log(`玩家1 下回合伤害加成: 0 → ${after1.next_turn_damage_modifier}`);
    console.log('\n✅ 预期: 玩家2受1伤害, 玩家1下回合伤害+3');
  });

  // ============ 技能2: 治疗加成 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到0点伤害，回复自己0点血量，然后自己下一回合所有回复增加2
  it('技能2 - 治疗加成: 下回合回复+2', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_4', {
      hp: 110,
      hand: [createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色4-强化 技能2 - 治疗加成');
    console.log('技能描述:', getSkillDescription('char_4', 1));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`); // 应该是0点伤害
    console.log(`玩家1 下回合回复加成: 0 → ${after1.next_turn_heal_modifier}`);
    console.log('\n✅ 预期: 玩家2不受伤害, 玩家1下回合回复+2');
  });

  // ============ 技能3: 双重强化 (消耗3) ============
  // 效果：指定一位其他玩家，使其受到3点伤害，回复自己3点血量，然后自己下一回合所有伤害增加3，所有回复增加3
  it('技能3 - 双向强化: 造成3伤害+回复3，下回合伤害+3回复+3', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_4', {
      hp: 80, // 低于满血
      hand: [createEnergyCard(3)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色4-强化 技能3 - 双重强化');
    console.log('技能描述:', getSkillDescription('char_4', 2));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 HP: 80 → ${after1.current_hp}, 下回合伤害加成: 0 → ${after1.next_turn_damage_modifier}, 下回合回复加成: 0 → ${after1.next_turn_heal_modifier}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家2受3伤害, 玩家1回复3, 下回合伤害+3回复+3');
  });

  // ============ 技能4: 终极强化 (消耗6) ============
  // 效果：指定一位其他玩家，使其受到0点伤害，然后自己下一回合所有伤害增加6，并从卡组中抽1张卡
  it('技能4 - 终极强化: 下回合伤害+6并抽1张卡', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_4', {
      hp: 110,
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        deck: [createEnergyCard(1)],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色4-强化 技能4 - 终极强化');
    console.log('技能描述:', getSkillDescription('char_4', 3));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 手牌: 1 → ${after1.hand.length}, 伤害加成: 0 → ${after1.damage_modifier}`);
    console.log('\n✅ 预期: 玩家1下回合伤害+6并抽1张卡');
  });
});