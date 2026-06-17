// 特殊卡效果测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, createSpecialCard, getTargetSummary } from './helpers';

describe('特殊卡效果测试', () => {
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

  // ============ 特殊卡1: 平分血量 ============
  // 效果：指定一位其他玩家，平分双方的当前血量
  it('特殊卡1 - 平分血量', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', { hp: 100 });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 60 });

    player1.hand = [createSpecialCard(1, '平分血量')];

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡1 - 平分血量');
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSpecialCard('player_1', 0, 'player_2');

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 HP: 100 → ${after1.current_hp}`);
    console.log(`玩家2 HP: 60 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 平分后都为80 (100+60)/2=80');
  });

  // ============ 特殊卡2: 低血量回复 ============
  // 效果：当血量低于一半时，使用此卡，回复自己四分之一最大血量；当血量低于一半时，使用此卡，自己再从卡组抽2张卡
  it('特殊卡2 - 低血量回复', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', { hp: 40, max_hp: 100 });
    player1.hand = [createSpecialCard(2, '低血量回复')];

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        deck: [createEnergyCard(1), createEnergyCard(2)],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡2 - 低血量回复');

    useGameStore.getState().useSpecialCard('player_1', 0);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 HP: 40 → ${after1.current_hp}, 手牌: 1 → ${after1.hand.length}`);
    console.log('\n✅ 预期: 血量<一半, 回复25HP=40+25=65, 抽2张卡');
  });

  // ============ 特殊卡3: 偷取手牌 ============
  // 效果：指定一位其他玩家，获得ta的1张手卡
  it('特殊卡3 - 偷取手牌', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', { hp: 100 });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hand: [createEnergyCard(1), createEnergyCard(2)],
    });

    player1.hand = [createSpecialCard(3, '偷取手牌')];

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡3 - 偷取手牌');
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSpecialCard('player_1', 0, 'player_2');

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 手牌: 1 → ${after1.hand.length}`);
    console.log(`玩家2 手牌: 2 → ${after2.hand.length}`);
    console.log('\n✅ 预期: 玩家1获得玩家2的1张手牌');
  });

  // ============ 特殊卡4: 令目标弃牌 ============
  // 效果：指定一位其他玩家，令ta弃置2张手卡
  it('特殊卡4 - 令目标弃牌', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', { hp: 100 });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hand: [createEnergyCard(1), createEnergyCard(2), createEnergyCard(3)],
    });

    player1.hand = [createSpecialCard(4, '令目标弃牌')];

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡4 - 令目标弃牌');

    useGameStore.getState().useSpecialCard('player_1', 0, 'player_2');

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 手牌: 3 → ${after2.hand.length}`);
    console.log('\n✅ 预期: 玩家2弃置2张手牌');
  });

  // ============ 特殊卡5: 换取先手 ============
  // 效果：自己弃置1张手卡，使用此卡，下一回合自己第一个行动
  it('特殊卡5 - 换取先手', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createEnergyCard(1), createSpecialCard(5, '换取先手')],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡5 - 换取先手');

    useGameStore.getState().useSpecialCard('player_1', 1);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 手牌: 2 → ${after1.hand.length}`);
    console.log(`玩家1 action_order_modifier: ${after1.action_order_modifier}`);
    console.log('\n✅ 预期: 弃1张手卡, action_order_modifier=-100(先手)');
  });

  // ============ 特殊卡6: 抽2张卡 ============
  it('特殊卡6 - 抽2张卡', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(6, '抽2张卡')],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        deck: [createEnergyCard(1), createEnergyCard(2)],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡6 - 抽2张卡');

    useGameStore.getState().useSpecialCard('player_1', 0);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 手牌: 1 → ${after1.hand.length}`);
    console.log('\n✅ 预期: 抽2张卡');
  });

  // ============ 特殊卡7: 弃2抽4 ============
  it('特殊卡7 - 弃2抽4', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createEnergyCard(1), createEnergyCard(2), createSpecialCard(7, '弃2抽4')],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        deck: [createEnergyCard(1), createEnergyCard(2), createEnergyCard(3), createEnergyCard(1)],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡7 - 弃2抽4');

    useGameStore.getState().useSpecialCard('player_1', 2);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 手牌: 3 → ${after1.hand.length}`);
    console.log('\n✅ 预期: 弃2张手卡, 抽4张卡');
  });

  // ============ 特殊卡8: 治疗印记 ============
  it('特殊卡8 - 治疗印记4回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(8, '治疗印记')],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡8 - 治疗印记4回合');

    useGameStore.getState().useSpecialCard('player_1', 0);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name + '(' + m.remaining_turns + ')').join(', ')}]`);
    console.log('\n✅ 预期: 附加治疗印记4回合');
  });

  // ============ 特殊卡9: 无垢印记 ============
  it('特殊卡9 - 无垢印记2回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(9, '无垢印记')],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡9 - 无垢印记2回合');

    useGameStore.getState().useSpecialCard('player_1', 0);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name + '(' + m.remaining_turns + ')').join(', ')}]`);
    console.log('\n✅ 预期: 附加无垢印记2回合');
  });

  // ============ 特殊卡10: 庇佑印记 ============
  it('特殊卡10 - 庇佑印记4回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(10, '庇佑印记')],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡10 - 庇佑印记4回合');

    useGameStore.getState().useSpecialCard('player_1', 0);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name + '(' + m.remaining_turns + ')').join(', ')}]`);
    console.log('\n✅ 预期: 附加庇佑印记4回合');
  });

  // ============ 特殊卡11: 鼓舞印记 ============
  it('特殊卡11 - 鼓舞印记3回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(11, '鼓舞印记')],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡11 - 鼓舞印记3回合');

    useGameStore.getState().useSpecialCard('player_1', 0);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name + '(' + m.remaining_turns + ')').join(', ')}]`);
    console.log('\n✅ 预期: 附加鼓舞印记3回合');
  });

  // ============ 特殊卡12: 灵感印记 ============
  it('特殊卡12 - 灵感印记2回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(12, '灵感印记')],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 })],
        deck: [createEnergyCard(1)],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡12 - 灵感印记2回合');

    useGameStore.getState().useSpecialCard('player_1', 0);

    const after1 = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name + '(' + m.remaining_turns + ')').join(', ')}]`);
    console.log('\n✅ 预期: 附加灵感印记2回合(下回合抽卡)');
  });

  // ============ 特殊卡13: 全体流血 ============
  it('特殊卡13 - 全体流血印记2回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(13, '全体���血')],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡13 - 全体流血2回合');

    useGameStore.getState().useSpecialCard('player_1', 0);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name).join(', ')}]`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name).join(', ')}]`);
    console.log('\n✅ 预期: 除自己外全场附加流血2回合');
  });

  // ============ 特殊卡14: 回复+中毒 ============
  it('特殊卡14 - 回复3点+目标中毒3回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 80,
      hand: [createSpecialCard(14, '回复+中毒')],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡14 - 回复3点+目标中毒3回合');

    useGameStore.getState().useSpecialCard('player_1', 0, 'player_2');

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 80 → ${after1.current_hp}`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + ')').join(', ')}]`);
    console.log('\n✅ 预期: 自身回复3点, 目标中毒3回合');
  });

  // ============ 特殊卡15: 单体诅咒 ============
  it('特殊卡15 - 目标诅咒1回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(15, '单体诅咒')],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 特殊卡15 - 目标诅咒1回合');

    useGameStore.getState().useSpecialCard('player_1', 0, 'player_2');

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + ')').join(', ')}]`);
    console.log('\n✅ 预期: 目标附加诅咒1回合');
  });

  // ============ 特殊卡16: 回合计次伤害 ============
  it('特殊卡16 - 回合数伤害+穿透', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_1', {
      hp: 100,
      hand: [createSpecialCard(16, '回合计次伤害')],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 5,
      },
    });

    console.log('\n🧪 测试: 特殊卡16 - 回合计次伤害');
    console.log('当前回合: 5');

    useGameStore.getState().useSpecialCard('player_1', 0, 'player_2');

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 目标受到5点伤害+5点穿透');
  });
});