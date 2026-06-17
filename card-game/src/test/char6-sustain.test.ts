// 角色6-持久 技能测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, getSkillDescription, getTargetSummary } from './helpers';

describe('角色6-持久 技能测试', () => {
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

  // ============ 技能1: 毒刃 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到1点穿透，然后回复自己2点血量
  it('技能1 - 毒刃: 1点穿透，回复2点血', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_6', {
      hp: 100,
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

    console.log('\n🧪 测试: 角色6-持久 技能1 - 毒刃');
    console.log('技能描述:', getSkillDescription('char_6', 0));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 100 → ${after1.current_hp}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家2受1穿透, 玩家1回复2血');
  });

  // ============ 技能2: 剧毒 (消耗2) ============
  // 效果：指定一位其他玩家，附加"中毒"印记1回合，然后回复自己2点血量，若该玩家已拥有"中毒"印记，则使其受到3点穿透
  it('技能2 - 剧毒: 中毒印记，已中毒则3穿透', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_6', {
      hp: 100,
      hand: [createEnergyCard(2)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      marks: [{ name: '中毒', remaining_turns: 1 }], // 已中毒
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色6-持久 技能2 - 剧毒');
    console.log('技能描述:', getSkillDescription('char_6', 1));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 HP: 100 → ${after1.current_hp}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}, 印记: [${after2.marks.map(m => m.name).join(', ')}]`);
    console.log('\n✅ 预期: 目标已中毒, 受3穿透, 玩家1回复2血');
  });

  // ============ 技能2续: 剧毒-目标未中毒 ============
  it('技能2 - 剧毒(目标未中毒): 附加中毒印记', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_6', {
      hp: 100,
      hand: [createEnergyCard(2)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色6-持久 技能2 - 剧毒(目标未中毒)');

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 印记: [${after2.marks.map(m => m.name).join(', ')}]`);
    console.log('\n✅ 预期: 附加中毒印记, 玩家1回复2血');
  });

  // ============ 技能3: 诅咒 (消耗3) ============
  // 效果：指定一位其他玩家，附加"诅咒"印记3回合，然后为自己附加"治疗"印记3回合
  it('技能3 - 诅咒: 附加诅咒3回合+治疗3回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_6', {
      hp: 115,
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

    console.log('\n🧪 测试: 角色6-持久 技能3 - 诅咒');
    console.log('技能描述:', getSkillDescription('char_6', 2));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}]`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}]`);
    console.log('\n✅ 预期: 目标附加诅咒3回合, 自己附加治疗3回合');
  });

  // ============ 技能4: 衰败 (消耗6, v2.2.1) ============
  // 效果（v2.2.1）：指定一位其他玩家，附加"流血"印记3回合，然后当回合数大于12时，
  //              使指定的玩家受到当前回合数一半加6的穿透，并回复自己当前回合数一半的血量
  it('技能4 - 衰败 (v2.2.1, 回合>12): 流血3回合 + 13穿透(15/2+6) + 自回7(15/2)', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_6', {
      hp: 100,
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 15, // >12
      },
    });

    console.log('\n🧪 测试: 角色6-持久 技能4 - 衰败 (v2.2.1)');
    console.log('技能描述:', getSkillDescription('char_6', 3));
    console.log('当前回合:', 15);
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 HP: 100 → ${after1.current_hp}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}, 穿透= ${Math.floor(15/2)+6}, 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}]`);
    console.log('\n✅ 预期: 目标附加流血3回合, 受13穿透(15/2向下取整7+6), 玩家1回复7血(15/2向下取整)');
  });

  // ============ 技能4续: 衰败 (回合<=12) ============
  it('技能4 - 衰败 (v2.2.1, 回合<=12): 流血3回合 + 无穿透 + 自回6(12/2)', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_6', {
      hp: 100,
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 12, // =12 (不>12)
      },
    });

    console.log('\n🧪 测试: 角色6-持久 技能4 - 衰败(回合=12)');

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 100 → ${after1.current_hp} (预期 +6 = 106)`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp} (预期 100, 无穿透)`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}]`);
    console.log('\n✅ 预期: 回合=12无穿透, 目标附加流血3回合, 玩家1回复6血(12/2)');
  });
});