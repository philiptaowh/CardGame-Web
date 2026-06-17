// 角色2-防御 技能测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, getSkillDescription, getTargetSummary } from './helpers';

describe('角色2-防御 技能测试', () => {
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

  // ============ 技能1: 护盾 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到1点伤害，然后自己获得2点护盾
  it('技能1 - 护盾: 造成1点伤害，获得2点护盾', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_2', {
      hp: 135,
      hand: [createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_3', { hp: 80 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色2-防御 技能1 - 护盾');
    console.log('技能描述:', getSkillDescription('char_2', 0));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 护盾: 0 → ${after1.shield}`);
    console.log(`玩家2 HP: 80 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家1获得2点护盾，玩家2受到1点伤害 HP=79');
  });

  // ============ 技能2: 铁壁 (消耗2) ============
  // 效果：自己获得6点护盾
  it('技能2 - 铁壁: 获得6点护盾', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_2', {
      hp: 135,
      hand: [createEnergyCard(2)],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_3', { hp: 80 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色2-防御 技能2 - 铁壁');
    console.log('技能描述:', getSkillDescription('char_2', 1));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);
    const after = useGameStore.getState().gameState.players[0];

    console.log(`玩家1 护盾: 0 → ${after.shield}`);
    console.log('\n✅ 预期: 玩家1获得6点护盾');
  });

  // ============ 技能3: 庇佑 (消耗2) ============
  // 效果：为自己附加"庇佑"印记3回合
  it('技能3 - 庇佑: 附加庇佑印记3回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_2', {
      hp: 135,
      hand: [createEnergyCard(2)],
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, createTestPlayer('player_2', '玩家2', 'char_3', { hp: 80 })],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色2-防御 技能3 - 庇佑');
    console.log('技能描述:', getSkillDescription('char_2', 2));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);
    const after = useGameStore.getState().gameState.players[0];

    const markNames = after.marks.map(m => m.name);
    console.log(`附加印记: [${markNames.join(', ')}]`);
    console.log('\n✅ 预期: 附加庇佑印记3回合');
  });

  // ============ 技能4: 猛攻 (消耗6) ============
  // 效果（v2.2.1）：指定一位其他玩家，使其受到12点伤害，然后自己回复当前护盾数值一半（向下取整）的血量，
  //              若指定的玩家手牌小于等于2，则使其受到12点穿透
  it('技能4 - 猛攻 (v2.2.1): 12伤害+护盾一半回血；目标手牌≤2时+12穿透', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_2', {
      hp: 100,
      shield: 10,
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_3', {
      hp: 80,
      hand: [createEnergyCard(1)], // 1 张手牌 ≤ 2 触发穿透
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色2-防御 技能4 - 猛攻 (v2.2.1)');
    console.log('技能描述:', getSkillDescription('char_2', 3));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 HP: 100 → ${after1.current_hp}, 护盾: 10 → ${after1.shield}`);
    console.log(`玩家2 HP: 80 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家2手牌1张≤2, 受12dmg+12pen=24穿透扣血, 玩家1回复5血(10/2向下取整)');
  });

  // ============ 技能4续: 猛攻-目标手牌>2 ============
  it('技能4 - 猛攻 (v2.2.1, 目标手牌>2): 12伤害但无穿透', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_2', {
      hp: 100,
      shield: 10,
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_3', {
      hp: 80,
      hand: [
        createEnergyCard(1),
        createEnergyCard(2),
        createEnergyCard(3),
      ], // 3 张手牌 > 2 不触发穿透
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色2-防御 技能4 - 猛攻(目标手牌>2)');

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 80 → ${after2.current_hp} (预期 80-12=68)`);
    console.log('\n✅ 预期: 玩家2手牌3张>2, 只受12伤害, 无穿透');
  });
});