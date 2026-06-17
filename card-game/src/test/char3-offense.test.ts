// 角色3-进攻 技能测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, getSkillDescription, getTargetSummary } from './helpers';

describe('角色3-进攻 技能测试', () => {
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

  // ============ 技能1: 斩击 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到3点伤害
  it('技能1 - 斩击: 造成3点伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_3', {
      hp: 80,
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

    console.log('\n🧪 测试: 角色3-进攻 技能1 - 斩击');
    console.log('技能描述:', getSkillDescription('char_3', 0));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家2受到3点伤害, HP=97');
  });

  // ============ 技能2: 穿刺 (消耗2) ============
  // 效果：指定一位其他玩家，使其受到4点伤害和2点穿透
  it('技能2 - 穿刺: 造成4点伤害和2点穿透', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_3', {
      hp: 80,
      hand: [createEnergyCard(2)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100, shield: 5 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色3-进攻 技能2 - 穿刺');
    console.log('技能描述:', getSkillDescription('char_3', 1));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家2 HP: 100 → ${after2.current_hp}, 护盾: 5 → ${after2.shield}`);
    console.log('\n✅ 预期: 护盾5抵伤害4剩1, 穿透2直达HP, HP=100-1-2=97');
  });

  // ============ 技能3: 猛砍 (消耗3) ============
  // 效果：指定一位其他玩家，使其受到6点伤害，然后自己从卡组中抽1张卡
  it('技能3 - 猛砍: 造成6点伤害并抽1张卡', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_3', {
      hp: 80,
      hand: [createEnergyCard(3)],
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

    console.log('\n🧪 测试: 角色3-进攻 技能3 - 猛砍');
    console.log('技能描述:', getSkillDescription('char_3', 2));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 手牌: 1 → ${after1.hand.length}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家2受到6点伤害, 玩家1抽1张卡');
  });

  // ============ 技能4: 毁灭 (消耗6) ============
  // 效果：指定一位其他玩家，使其受到12点伤害和6点穿透，然后若指定的玩家当前血量大于自己当前血量，则再使其受到18点穿透
  it('技能4 - 毁灭: 造成12伤害+6穿透，目标血多则再受18穿透', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_3', {
      hp: 60, // 较低血量
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100, // 较高血量
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色3-进攻 技能4 - 毁灭');
    console.log('技能描述:', getSkillDescription('char_3', 3));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 目标血>自己血, 12+6+18=36穿透, HP=100-36=64');
  });
});