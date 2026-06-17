// 跨回合modifier机制测试

import { describe, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createTestPlayer, createEnergyCard, snapshotPlayer } from './helpers';

describe('跨回合Modifier机制测试', () => {
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

  // ============ 测试: 回合1设置modifier，回合2开始时生效 ============
  it('回合1: 角色4使用skill1设置下回合伤害+3', () => {
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
        turn: 1,
        gameMode: '1v1',
        phase1_results: null,
      },
    });

    console.log('\n🧪 测试: 回合1 - 使用技能设置下回合伤害+3');
    console.log('\n--- 使用技能前 ---');
    console.log(`玩家1 next_turn_damage_modifier: ${player1.next_turn_damage_modifier}`);

    // 使用 skill 1: 造成1点伤害，设置下回合伤害+3
    useGameStore.getState().useSkill('player_1', 0, 'player_2', [0]);

    const afterSkill1 = useGameStore.getState().gameState.players[0];
    console.log('\n--- 使用技能后 ---');
    console.log(`玩家2 HP: 100 → ${afterSkill1.current_hp}`); // 应该扣了1点
    console.log(`玩家1 next_turn_damage_modifier: ${afterSkill1.next_turn_damage_modifier}`);
    console.log('\n✅ 预期: 玩家2受1伤害, 玩家1下回合伤害+3');

    // 模拟回合结束：endTurn 会将 next_turn 转移到 damage_modifier
    console.log('\n--- 回合结束，调用endTurn ---');
    useGameStore.getState().endTurn();

    const afterTurn1 = useGameStore.getState().gameState.players[0];
    console.log(`玩家1 damage_modifier: ${afterTurn1.damage_modifier}`);
    console.log(`玩家1 next_turn_damage_modifier: ${afterTurn1.next_turn_damage_modifier}`);
    console.log(`回合数: 1 → ${useGameStore.getState().gameState.turn}`);
  });

  // ============ 测试: 回合2使用skill2，再设置下回合回复+2 ============
  it('回合2: 角色4使用skill2设置下回合回复+2，确认modifier累积', () => {
    // 此测试依赖上一个测试的状态，单独设置
    resetStore();

    const player1 = createTestPlayer('player_1', '玩家1', 'char_4', {
      hp: 110,
      hand: [createEnergyCard(1), createEnergyCard(1)],
    });
    const player2 = createTestPlayer('player_2', '玩家2', 'char_1', { hp: 100 });

    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
        turn: 2, // 直接从回合2开始
      },
    });

    console.log('\n🧪 测试: 回合2 - 使用skill2再设置下回合回复+2');

    // 直接设置上回合留下的伤害modifier（模拟回合1结束时转移过来的）
    player1.damage_modifier = 3; // 模拟上回合设置的+3
    useGameStore.setState({
      gameState: {
        ...useGameStore.getState().gameState,
        players: [player1, player2],
      },
    });

    console.log('\n--- 回合2开始 ---');
    console.log(`玩家1 damage_modifier: ${player1.damage_modifier}`);

    // 使用 skill 2: 设置下回合回复+2
    useGameStore.getState().useSkill('player_1', 1, 'player_2', [0]);

    const afterSkill2 = useGameStore.getState().gameState.players[0];
    console.log('\n--- 使用技能后 ---');
    console.log(`玩家1 damage_modifier: ${afterSkill2.damage_modifier}`); // 应该还是3（没被清0）
    console.log(`玩家1 next_turn_heal_modifier: ${afterSkill2.next_turn_heal_modifier}`); // 应该是2
  });
});