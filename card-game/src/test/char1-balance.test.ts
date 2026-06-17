// 角色1-平衡 技能测试

import { describe, it, expect } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, snapshotPlayer, printStateDiff, getSkillDescription, getTargetSummary } from './helpers';
import type { CharacterId } from '../types';

describe('角色1-平衡 技能测试', () => {
  // 重置store状态
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

  // ============ 技能1: 攻击 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到3点伤害
  it('技能1 - 攻击: 造成3点伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createEnergyCard(1)],
    });

    const player2 = createTestPlayer('player_2', '玩家2', 'char_3', {
      hp: 80,
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色1-平衡 技能1 - 攻击');
    console.log('技能描述:', getSkillDescription('char_1', 0));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const afterPlayer2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家2 HP: 80 → ${afterPlayer2.current_hp}`);
    console.log('\n✅ 预期: 玩家2受到3点伤害, HP=77');
  });

  // ============ 技能2: 回复 (消耗2) ============
  // 效果：回复自己4点血量
  it('技能2 - 回复: 回复自己4点血量', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 80,
      hand: [createEnergyCard(2)],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_3', { hp: 80 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色1-平衡 技能2 - 回复');
    console.log('技能描述:', getSkillDescription('char_1', 1));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);
    const after = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 HP: 80 → ${after.current_hp}`);
    console.log('\n✅ 预期: 玩家1回复4点血量, HP=84');
  });

  // ============ 技能3: 强化 (消耗3) ============
  // 效果：为自己附加"无垢"和"灵感"印记2回合
  it('技能3 - 强化: 附加无垢和灵感印记各2回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createEnergyCard(3)],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_3', { hp: 80 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色1-平衡 技能3 - 强化');
    console.log('技能描述:', getSkillDescription('char_1', 2));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);
    const after = useGameStore.getState().gameState.players[0];

    const markNames = after.marks.map(m => m.name);
    console.log(`附加印记: [${markNames.join(', ')}]`);
    console.log('\n✅ 预期: 附加无垢和灵感印记2回合');
  });

  // ============ 技能4: 抽牌攻击 (消耗4) ============
  // 效果：指定一位其他玩家，使其受到8点伤害和4点穿透，然后自己从卡组中抽1张卡
  it('技能4 - 抽牌攻击: 造成8伤害+4穿透并抽1张卡', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createEnergyCard(4)],
    });

    const player2 = createTestPlayer('player_2', '玩家2', 'char_3', {
      hp: 80,
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        deck: [createEnergyCard(1), createEnergyCard(2)],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色1-平衡 技能4 - 抽牌攻击');
    console.log('技能描述:', getSkillDescription('char_1', 3));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 手牌: 1 → ${after1.hand.length}`);
    console.log(`玩家2 HP: 80 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家2受到8伤害+4穿透=12, HP=68, 玩家1抽1张卡');
  });
});