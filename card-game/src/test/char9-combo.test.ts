// 角色9-连击 技能测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, getSkillDescription, getTargetSummary } from './helpers';

describe('角色9-连击 技能测试', () => {
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

  // ============ 技能1: 连斩 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到2点伤害和1点穿透
  it('技能1 - 连斩: 2伤害+1穿透', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_9', {
      hp: 90,
      hand: [createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100, shield: 5 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色9-连击 技能1 - 连斩');
    console.log('技能描述:', getSkillDescription('char_9', 0));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家2 HP: 100 → ${after2.current_hp}, 护盾: 5 → ${after2.shield}`);
    console.log('\n✅ 预期: 护盾5抵2伤害剩3, 穿透1直抵HP, HP=100-3-1=96');
  });

  // ============ 技能2: Combo (消耗2) ============
  // 效果：自己下一回合所有伤害增加2，所有穿透增加2，所有回复增加1
  it('技能2 - Combo: 下回合伤害+2穿透+2回复+1', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_9', {
      hp: 90,
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

    console.log('\n🧪 测试: 角色9-连击 技能2 - Combo');
    console.log('技能描述:', getSkillDescription('char_9', 1));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 下回合伤害加成: ${after1.damage_modifier}`);
    console.log(`玩家1 下回合穿透加成: ${after1.penetration_modifier}`);
    console.log(`玩家1 下回合回复加成: ${after1.heal_modifier}`);
    console.log('\n✅ 预期: 下回合伤害+2, 穿透+2, 回复+1');
  });

  // ============ 技能3: 抽牌 (消耗2) ============
  // 效果：指定一位其他玩家，使其受到0点伤害，然后回复自己0点血量并从卡组中抽1张卡
  it('技能3 - 抽牌: 抽1张卡', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_9', {
      hp: 90,
      hand: [createEnergyCard(2)],
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

    console.log('\n🧪 测试: 角色9-连击 技能3 - 抽牌');
    console.log('技能描述:', getSkillDescription('char_9', 2));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 手牌: 1 → ${after1.hand.length}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家2不受伤害, 玩家1抽1张卡');
  });

  // ============ 技能4: 狂怒 (消耗6) ============
  // 效果：指定一位其他玩家，使其受到本回合自己已经使用技能的次数2倍的穿透，然后若本回合自己使用技能的次数小于等于3，则为自己附加"无垢"和"灵感"印记1回合
  it('技能4 - 狂怒: 受技能次数x2穿透，次数<=3则附加无垢+灵感', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_9', {
      hp: 90,
      hand: [createEnergyCard(1), createEnergyCard(1), createEnergyCard(6)],
      skillsUsedThisTurn: 2, // 已使用2次技能
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

    console.log('\n🧪 测试: 角色9-连击 技能4 - 狂怒(已用2次)');
    console.log('技能描述:', getSkillDescription('char_9', 3));
    console.log('本回合技能使用次数: 2');

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [2]); // 用第3张卡支付

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log(`玩家1 印记: [${after1.marks.map(m => m.name).join(', ')}]`);
    console.log('\n✅ 预期: 受2x2=4穿透, 次数<=3附加无垢+灵感');
  });

  // ============ 技能4续: 狂怒-已用4次 ============
  it('技能4 - 狂怒(已用4次): 只受穿透，无印记', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_9', {
      hp: 90,
      hand: [createEnergyCard(1), createEnergyCard(1), createEnergyCard(6)],
      skillsUsedThisTurn: 4, // 已使用4次技能
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色9-连击 技能4 - 狂怒(已用4次)');
    console.log('本回合技能使用次数: 4');

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [2]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log(`玩家1 印记: [${after1.marks.map(m => m.name).join(', ')}]`);
    console.log('\n✅ 预期: 受4x2=8穿透, 次数>3无印记');
  });
});