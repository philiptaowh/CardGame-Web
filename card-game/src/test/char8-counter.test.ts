// 角色8-反击 技能测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, getSkillDescription, getTargetSummary } from './helpers';

describe('角色8-反击 技能测试', () => {
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

  // ============ 技能1: 反伤 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到2点伤害，然后若本回合自己受到过伤害，则使其再受到2点伤害
  it('技能1 - 反伤: 2伤害，受过伤则+2伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_8', {
      hp: 80,
      hand: [createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色8-反击 技能1 - 反伤(玩家未受伤)');
    console.log('技能描述:', getSkillDescription('char_8', 0));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家未受伤, 只受2伤害, HP=98');
  });

  // ============ 技能1续: 反伤-玩家受伤 ============
  it('技能1 - 反伤(玩家已受伤): 2+2=4伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_8', {
      hp: 90, // 低于max_hp表示受过伤害
      max_hp: 105,
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

    console.log('\n🧪 测试: 角色8-反击 技能1 - 反伤(玩家已受伤)');

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家已受伤, 受2+2=4伤害, HP=96');
  });

  // ============ 技能2: 反击 (消耗2) ============
  // 效果：指定一位其他玩家，使其受到4点伤害，然后若本回合自己受到过伤害，则回复自己4点血量
  it('技能2 - 反击: 4伤害，受过伤则回复4血', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_8', {
      hp: 80,
      max_hp: 105,
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

    console.log('\n🧪 测试: 角色8-反击 技能2 - 反击(玩家已受伤)');
    console.log('技能描述:', getSkillDescription('char_8', 1));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 80 → ${after1.current_hp}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家已受伤, 受4伤害, 玩家1回复4血');
  });

  // ============ 技能2续: 反击-玩家未受伤 ============
  it('技能2 - 反击(玩家未受伤): 只造成4伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_8', {
      hp: 105,
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

    console.log('\n🧪 测试: 角色8-反击 技能2 - 反击(玩家未受伤)');

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 105 → ${after1.current_hp}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 玩家未受伤, 只受4伤害, 无回复');
  });

  // ============ 技能3: 反咒 (消耗3) ============
  // 效果：指定一位其他玩家，使其受到6点伤害，然后若本回合自己受到过伤害，则令指定的玩家附加"诅咒"印记1回合
  it('技能3 - 反咒: 6伤害，受过伤则附加诅咒', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_8', {
      hp: 90,
      max_hp: 105,
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

    console.log('\n🧪 测试: 角色8-反击 技能3 - 反咒(玩家已受伤)');
    console.log('技能描述:', getSkillDescription('char_8', 2));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name).join(', ')}]`);
    console.log('\n✅ 预期: 玩家已受伤, 受6伤害并附加诅咒');
  });

  // ============ 技能4: 反叛 (消耗6, v2.2.1) ============
  // 效果（v2.2.1 重做）：6 伤害 + 6 穿透 + 条件翻转：若本回合自己未受到过伤害
  //              → 自损 4 + 目标额外 4 伤害
  // 旧版本：若本回合自己受到过伤害 → target 附加 失神
  it('技能4 - 反叛 (v2.2.1, 玩家已受伤): 6伤害+6穿透，无自损无额外伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_8', {
      hp: 90,
      max_hp: 105, // 已受伤（90 < 105）
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色8-反击 技能4 - 反叛 (v2.2.1, 玩家已受伤)');
    console.log('技能描述:', getSkillDescription('char_8', 3));

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 90 → ${after1.current_hp} (预期 90, 无自损)`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp} (预期 100-6-6=88, 12 穿透)`);
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name).join(', ')}] (预期 无印记)`);
    console.log('\n✅ 预期: 玩家已受伤, 无自损, 目标受 6 伤害 + 6 穿透, 无失神');
  });

  // ============ 技能4续: 反叛 (玩家未受伤) ============
  it('技能4 - 反叛 (v2.2.1, 玩家未受伤): 自损4 + 目标额外4', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_8', {
      hp: 105, // 满血，未受伤
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色8-反击 技能4 - 反叛 (v2.2.1, 玩家未受伤)');

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 HP: 105 → ${after1.current_hp} (预期 105-4=101, 自损)`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp} (预期 100-6-6-4=84, 受 16 穿透)`);
    console.log('\n✅ 预期: 玩家未受伤, 自损4 + 目标受 6+6+4=16 穿透');
  });

  // ============ v2.2.1 新增: 技能4 自损后影响技能1-3 ============
  // 场景：先用「反叛」(cost 6) 自损4，然后立刻用「反伤」(cost 1) 验证
  // 预期：took_damage_this_turn 已为 true（自损也会标记）→ 反伤技能1 触发 +2 伤害分支
  it('v2.2.1 新增 - 技能4自损影响技能1-3: 自损后反伤触发+2伤害分支', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_8', {
      hp: 105, // 满血 → 反叛触发自损
      hand: [
        createEnergyCard(6), // 支付反叛
        createEnergyCard(1),  // 支付反伤
      ],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 200 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色8-反击 技能4自损后影响技能1 (v2.2.1)');
    console.log('--- 步骤1: 反叛(自损4) ---');
    // 第一次: 用 3号技能(反叛, cost 6) 支付 [0] → 自损4 + 目标受 6+6+4=16 穿透
    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const mid1 = useGameStore.getState().gameState.players[0];
    console.log(`玩家1 HP: 105 → ${mid1.current_hp} (预期 101, 自损4)`);

    console.log('--- 步骤2: 反伤(应触发+2分支) ---');
    // 第二次: 用 0号技能(反伤, cost 1) 支付 [0] → took_damage=true, 触发 +2 伤害
    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 200 → ${after2.current_hp}`);
    console.log(`(步骤1: 200 - 16 = 184, 步骤2: 184 - 2 - 2 = 180)`);
    console.log('\n✅ 预期: 反叛自损4后, took_damage_this_turn=true, 反伤触发 +2 伤害分支 (2+2=4)');
  });
});