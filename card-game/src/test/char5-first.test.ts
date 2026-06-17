// 角色5-先手 技能测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, getSkillDescription, getTargetSummary } from './helpers';

describe('角色5-先手 技能测试', () => {
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

  // ============ 技能1: 先攻 (消耗1) ============
  // 效果：指定一位其他玩家，使其受到2点伤害，然后若该玩家还未行动则使其再受到2点伤害
  it('技能1 - 先攻: 造成2伤害，目标未行动则+2伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hasActedThisTurn: false, // 目标未行动
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 技能1 - 先攻');
    console.log('技能描述:', getSkillDescription('char_5', 0));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 目标未行动, 受2+2=4伤害, HP=96');
  });

  // ============ 技能1续: 先攻-目标已行动 ============
  it('技能1 - 先攻(目标已行动): 只造成2伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hasActedThisTurn: true, // 目标已行动
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 技能1 - 先攻(目标已行动)');
    console.log('--- 测试前 ---');
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 目标已行动, 只受2伤害, HP=98');
  });

  // ============ 技能2: 抢先 (消耗2) ============
  // 效果：指定一位其他玩家，使其受到2点伤害，然后若该玩家还未行动，则自己从卡组中抽1张卡，同一回合内此技能最多使用3次
  it('技能2 - 抢先: 造成2伤害，目标未行动则抽1张卡', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(2)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hasActedThisTurn: false,
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        deck: [createEnergyCard(1)],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 技能2 - 抢先');
    console.log('技能描述:', getSkillDescription('char_5', 1));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player1));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家1 手牌: 1 → ${after1.hand.length}`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log('\n✅ 预期: 目标未行动, 玩家1抽1张卡');
  });

  // ============ 技能1-睡眠目标: 先攻 ============
  // 验证：当目标处于睡眠状态时，技能1 仍能触发"若该玩家还未行动"的 +2 伤害加成
  // 依据：docs/extra_rule.md —— "对手被睡眠跳过 → has_acted_this_turn = false → 先手技能触发加成"
  it('技能1 - 先攻(目标睡眠): 睡眠目标仍按"未行动"处理，+2 伤害', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hasActedThisTurn: false, // 睡眠跳过不标记
      hasSleep: true,         // 目标处于睡眠
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 技能1 - 先攻(目标睡眠)');

    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log(`玩家2 has_acted_this_turn: ${after2.has_acted_this_turn} (预期: false)`);
    console.log('\n✅ 预期: 目标睡眠视为未行动, 受2+2=4伤害, HP=96');
  });

  // ============ 技能2-睡眠目标: 抢先 ============
  // 验证：当目标处于睡眠状态时，技能2 仍能触发抽 1 张卡
  it('技能2 - 抢先(目标睡眠): 睡眠目标仍按"未行动"处理，触发抽卡', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(2)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hasActedThisTurn: false,
      hasSleep: true,
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        deck: [createEnergyCard(1)],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 技能2 - 抢先(目标睡眠)');
    console.log('技能描述:', getSkillDescription('char_5', 1));

    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家1 手牌: 1 → ${after1.hand.length} (2能量作支付弃置, 抽1张后仍为 1)`);
    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log(`玩家2 has_acted_this_turn: ${after2.has_acted_this_turn} (预期: false)`);
    console.log('\n✅ 预期: 目标睡眠视为未行动, 玩家1 抽 1 张卡 (手牌非 0 即证明 drawCard 被调用)');
  });

  // ============ 技能3-睡眠目标: 突袭 ============
  // 验证：当目标处于睡眠状态时，技能3 仍能为自己附加"鼓舞"印记
  it('技能3 - 突袭(目标睡眠): 睡眠目标仍按"未行动"处理，附加鼓舞', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(3)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hasActedThisTurn: false,
      hasSleep: true,
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 技能3 - 突袭(目标睡眠)');
    console.log('技能描述:', getSkillDescription('char_5', 2));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log(`玩家1 印记: [${after1.marks.map(m => m.name).join(', ')}] (预期含 鼓舞)`);
    console.log('\n✅ 预期: 目标睡眠视为未行动, 玩家1 附加 鼓舞 印记');
  });

  // ============ 技能3: 突袭 (消耗3) ============
  // 效果：指定一位其他玩家，使其受到3点伤害和3点穿透，然后若该玩家还未行动，则为自己附加"鼓舞"印记1回合
  it('技能3 - 突袭: 3伤害+3穿透，目标未行动则附加鼓舞', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(3)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hasActedThisTurn: false,
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 技能3 - 突袭');
    console.log('技能描述:', getSkillDescription('char_5', 2));

    useGameStore.getState().useSkill('player_1', 2, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`玩家2 HP: 100 → ${after2.current_hp}`);
    console.log(`玩家1 印记: [${after1.marks.map(m => m.name).join(', ')}]`);
    console.log('\n✅ 预期: 目标未行动, 受3+3=6伤害, 附加鼓舞');
  });

  // ============ 技能4: 致盲 (消耗6) ============
  // 效果：指定一位其他玩家，附加"失明"印记1回合，然后若该玩家已经行动，则额外附加"睡眠"印记1回合，且自己下一回合所有伤害增加2
  it('技能4 - 致盲: 附加失明，已行动则+睡眠，自身下回合伤害+2', () => {
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(6)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', {
      hp: 100,
      hasActedThisTurn: true, // 目标已行动
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 技能4 - 致盲');
    console.log('技能描述:', getSkillDescription('char_5', 3));
    console.log('\n--- 测试前 ---');
    console.log(getTargetSummary(player2));

    useGameStore.getState().useSkill('player_1', 3, 'player_2', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log('\n--- 测试后 ---');
    console.log(`玩家2 印记: [${after2.marks.map(m => m.name).join(', ')}]`);
    console.log(`玩家1 下回合伤害加成: 0 → ${after1.damage_modifier}`);
    console.log('\n✅ 目标已行动, 附加失明+睡眠, 自身伤害+2');
  });

  // ============ v2.2.1 新增: 完整 action order + 敌方睡眠 ============
  // 场景：
  //   - player_1 (char_4) 行动顺序排第一 + 处于睡眠
  //   - player_2 (char_5 先手) 行动顺序排第二
  //   - 模拟 advancePhase 跳过 player_1（睡眠跳过）→ 切到 player_2
  //   - char_5 用技能1/2/3 对 player_1
  // 预期：player_1 被睡眠跳过，has_acted_this_turn=false，先手"未行动"加成仍触发
  it('v2.2.1 新增 - 完整 action order: 敌方睡眠跳过,先手仍能获得"未行动"加成', () => {
    resetStore();

    // player_1 (char_4) 行动顺序排第一, 处于睡眠 (将被跳过)
    const player1 = createTestPlayer('player_1', '玩家1', 'char_4', {
      hp: 110,
      hasSleep: true, // 睡眠状态
      hand: [],
    });
    // player_2 (char_5 先手) 行动顺序排第二
    const player2 = createTestPlayer('player_2', '玩家2', 'char_5', {
      hp: 90,
      hand: [createEnergyCard(1)], // 支付 技能1 先攻
    });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        action_order: ['player_1', 'player_2'], // player_1 先, player_2 后
        current_player_index: 0,
        turn: 2,
      },
    });

    console.log('\n🧪 测试: 角色5-先手 完整 action order + 敌方睡眠 (v2.2.1)');
    console.log('--- 步骤1: 模拟 player_1 被睡眠跳过 (advancePhase) ---');
    // 模拟阶段2入口: player_1 有 sleep → 回血 + 跳过 → 切到 player_2
    useGameStore.getState().advancePhase();

    const stateAfterSkip = useGameStore.getState().gameState;
    console.log(`当前玩家索引: 0 → ${stateAfterSkip.current_player_index} (预期 1, 切到 player_2)`);
    console.log(`player_1.has_acted_this_turn: ${stateAfterSkip.players[0].has_acted_this_turn} (预期 false, 睡眠跳过不标记)`);
    console.log(`player_1 HP: 110 → ${stateAfterSkip.players[0].current_hp} (预期 110, 满血)`);

    console.log('--- 步骤2: char_5 (player_2) 对 player_1 用技能1先攻 ---');
    // 切到 player_2 后, 用技能 0 (先攻, cost 1)
    useGameStore.getState().useSkill('player_2', 0, 'player_1', [0]);

    const after1 = useGameStore.getState().gameState.players[0];
    const after2 = useGameStore.getState().gameState.players[1];

    console.log(`player_1 HP: 110 → ${after1.current_hp} (预期 110-4=106, 2+2=4 伤害)`);
    console.log(`player_2 状态: HP ${after2.current_hp}, 行动后状态正常`);
    console.log('\n✅ 预期: 睡眠玩家被跳过, has_acted=false, 先手"未行动"加成触发 (2+2=4 伤害)');
  });
});