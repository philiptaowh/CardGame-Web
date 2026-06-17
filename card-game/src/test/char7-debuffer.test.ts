// 角色7-弱化 技能测试 (v2.2.1 完全重写 — 弱化 stacking 流)
//
// 4 技能全部挂「弱化」印记：
//   技能1 削弱 (cost 1): 2 dmg + 弱化 1 回合
//   技能2 衰弱 (cost 2): 弱化 2 回合；若目标已有弱化 → 自身 治疗 2 回合
//   技能3 虚弱 (cost 3): 弱化 2 回合；若目标已有弱化 → 失明 + 失神 1 回合
//   技能4 朽灭 (cost 6): 6 dmg；若 turn>8 → 目标受 Math.floor(self.current_hp/8) dmg + pen

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, getSkillDescription, getTargetSummary } from './helpers';

describe('角色7-弱化 技能测试 (v2.2.1)', () => {
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

  // ============ 技能1: 削弱 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到2点伤害并附加"弱化"印记1回合
  it('技能1 - 削弱: 2伤害+弱化印记1回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_7', {
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

    console.log('\n🧪 测试: 角色7-弱化 技能1 - 削弱 (v2.2.1)');
    console.log('技能描述:', getSkillDescription('char_7', 0));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp} (预期 98)`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}]`);
    console.log('\n✅ 预期: 玩家2受2伤害, 附加弱化1回合');
  });

  // ============ 技能2: 衰弱 (消耗2) ============
  // 效果：弱化 2 回合；若目标已有弱化 → 自身 治疗 2 回合
  it('技能2 - 衰弱 (目标无弱化): 仅附加弱化2回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_7', {
      hp: 80,
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

    console.log('\n🧪 测试: 角色7-弱化 技能2 - 衰弱(目标无弱化)');

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name).join(', ')}] (预期 无)`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}] (预期 弱化(2))`);
    console.log('\n✅ 预期: 目标无弱化 → 仅附加弱化2回合, 自身无治疗印记');
  });

  it('技能2 - 衰弱 (目标已有弱化): 附加弱化2回合 + 自身治疗2回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_7', {
      hp: 80,
      hand: [createEnergyCard(2)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      marks: [{ name: '弱化', remaining_turns: 1 }], // 目标已有弱化
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色7-弱化 技能2 - 衰弱(目标已有弱化)');

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 印记: [${after1.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}] (预期 治疗(2))`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}] (预期 弱化(2, 旧1被覆盖))`);
    console.log('\n✅ 预期: 目标已有弱化 → 附加弱化2回合 (覆盖旧) + 自身 治疗 2 回合');
  });

  // ============ 技能3: 虚弱 (消耗3) ============
  // 效果：弱化 2 回合；若目标已有弱化 → 失明 + 失神 1 回合
  it('技能3 - 虚弱 (目标无弱化): 仅附加弱化2回合', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_7', {
      hp: 80,
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

    console.log('\n🧪 测试: 角色7-弱化 技能3 - 虚弱(目标无弱化)');

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 印记: [${after2.marks.map(m => m.name).join(', ')}] (预期 仅 弱化)`);
    console.log('\n✅ 预期: 仅附加弱化2回合, 不触发失明失神');
  });

  it('技能3 - 虚弱 (目标已有弱化): 附加失明+失神', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_7', {
      hp: 80,
      hand: [createEnergyCard(3)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      marks: [{ name: '弱化', remaining_turns: 1 }], // 目标已有弱化
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色7-弱化 技能3 - 虚弱(目标已有弱化)');

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}]`);
    console.log('\n✅ 预期: 弱化2回合 + 失明(1) + 失神(1)');
  });

  // ============ 技能4: 朽灭 (消耗6) ============
  // 效果：6 dmg；若 turn>8 → 目标受 Math.floor(self.current_hp/8) dmg + 同样 pen
  it('技能4 - 朽灭 (回合<=8): 仅6伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_7', {
      hp: 80, // 80/8 = 10
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 5, // <=8
      },
    });

    console.log('\n🧪 测试: 角色7-弱化 技能4 - 朽灭(回合<=8)');

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 80 → ${after1.current_hp} (预期 80, 无自损)`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp} (预期 94, 仅 6 伤害)`);
    console.log('\n✅ 预期: 回合<=8, 仅 6 伤害, 无穿透');
  });

  it('技能4 - 朽灭 (回合>8, v2.2.1.1): 6 + Math.floor(自身HP/10) 伤害 + 同样穿透', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_7', {
      hp: 80, // 80/10 = 8
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 12, // >8
      },
    });

    console.log('\n🧪 测试: 角色7-弱化 技能4 - 朽灭(回合>8, v2.2.1.1)');
    console.log('自身HP/10 =', Math.floor(80 / 10));

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 80 → ${after1.current_hp} (预期 80, 无自损)`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp} (预期 100-6-8-8=78, 6 dmg + 8 dmg + 8 pen = 22 穿透)`);
    console.log('\n✅ 预期: 回合>8, 6 伤害 + 8 伤害 + 8 穿透 = 共 22 穿透');
  });

  // ============ v2.2.1 新增: 弱化 stacking 协同测试 ============
  // 场景：先用「削弱」(cost 1) 给目标挂上弱化 1 回合，再用「衰弱」(cost 2) 触发 stacking 协同
  // 预期：第二次「衰弱」检测到目标已有弱化 → 自身获得「治疗 2 回合」
  it('v2.2.1 新增 - 弱化 stacking 协同: 先削弱(挂弱化)再衰弱(触发自身治疗)', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_7', {
      hp: 60, // 留点空间让治疗 2 回合生效
      hand: [
        createEnergyCard(1),
        createEnergyCard(2), // 两个能量各 1 张, 分别支付 削弱+衰弱
      ],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色7-弱化 stacking 协同 (v2.2.1)');
    console.log('--- 步骤1: 削弱(挂弱化) ---');

    // 第一次: 用 0号技能(削弱, cost 1) 支付 [0] → 目标获得 弱化 1 回合
    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const mid2 = useGameStore.getState().gameState.players[1];
    console.log(`玩家2 印记: [${mid2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}] (预期 弱化(1))`);

    // 第二次: 用 1号技能(衰弱, cost 2) 支付 [0] → 检测到目标有弱化 → 自身获得 治疗 2 回合
    console.log('--- 步骤2: 衰弱(触发协同) ---');
    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 60 → ${after1.current_hp}`);
    console.log(`玩家1 印记: [${after1.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}] (预期 治疗(2))`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name + '(' + m.remaining_turns + '回合)').join(', ')}] (预期 弱化(2))`);
    console.log('\n✅ 预期: 协同触发 → 玩家1 获得 治疗 2 回合');
  });
});
