// v2.2.0-alpha 后端 - 路由纯逻辑 smoke test
//
// 用法：npx tsx src/__test__/validation.test.ts
// 不依赖 MySQL，只验证 validateReplay / deriveWinner

import { strict as assert } from 'node:assert';

// 复制 routes/replays.ts 里的纯函数（保持同步）
// —— 简单粗暴：避免导出内部函数污染路由模块

type V1Replay = {
  version: string;
  timestamp: number;
  gameMode: string;
  config: {
    humanCharId: string;
    aiCharId: string;
    policies: Array<{ playerId: string; policyName: string }>;
  };
  moves: unknown[];
  winner: string | null;
  finalState: { turn: number; players: unknown[] };
};

function validateReplay(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'body 必须是对象';
  const r = body as Partial<V1Replay>;
  if (typeof r.version !== 'string') return '缺少 version';
  if (typeof r.timestamp !== 'number') return '缺少 timestamp';
  if (typeof r.gameMode !== 'string') return '缺少 gameMode';
  if (!r.config || typeof r.config !== 'object') return '缺少 config';
  if (typeof r.config.humanCharId !== 'string') return '缺少 config.humanCharId';
  if (typeof r.config.aiCharId !== 'string') return '缺少 config.aiCharId';
  if (!Array.isArray(r.moves)) return '缺少 moves[]';
  if (!r.finalState || typeof r.finalState !== 'object') return '缺少 finalState';
  if (!Array.isArray(r.finalState.players)) return '缺少 finalState.players[]';
  return null;
}

function deriveWinner(replay: V1Replay): 'player' | 'ai' | 'draw' {
  if (replay.winner === null) return 'draw';
  const winningPolicy = replay.config.policies.find(p => p.playerId === replay.winner);
  if (!winningPolicy) return 'draw';
  if (winningPolicy.policyName === 'human') return 'player';
  return 'ai';
}

// ============ 测试用例 ============

const validReplay: V1Replay = {
  version: '2.1.1-v1-replay',
  timestamp: 1717200000000,
  gameMode: '1v1',
  config: {
    humanCharId: 'char_1',
    aiCharId: 'char_3',
    policies: [
      { playerId: 'p1', policyName: 'human' },
      { playerId: 'p2', policyName: 'optimal_char_3' },
    ],
  },
  moves: [],
  winner: 'p1',
  finalState: { turn: 5, players: [] },
};

// 1) valid
assert.equal(validateReplay(validReplay), null, 'valid replay should pass');
console.log('✅ validateReplay(valid) === null');

// 2) null body
assert.equal(validateReplay(null), 'body 必须是对象');
console.log('✅ validateReplay(null) → body 必须是对象');

// 3) missing config
assert.equal(validateReplay({ ...validReplay, config: undefined }), '缺少 config');
console.log('✅ validateReplay(无 config) → 缺少 config');

// 4) missing moves
assert.equal(validateReplay({ ...validReplay, moves: 'not-array' }), '缺少 moves[]');
console.log('✅ validateReplay(moves 非数组) → 缺少 moves[]');

// 5) winner = human policy
assert.equal(deriveWinner({ ...validReplay, winner: 'p1' }), 'player');
console.log('✅ deriveWinner(winner 是 human policy) === player');

// 6) winner = AI policy
assert.equal(deriveWinner({ ...validReplay, winner: 'p2' }), 'ai');
console.log('✅ deriveWinner(winner 是 AI policy) === ai');

// 7) winner = null → draw
assert.equal(deriveWinner({ ...validReplay, winner: null }), 'draw');
console.log('✅ deriveWinner(winner=null) === draw');

// 8) winner = unknown id → draw
assert.equal(deriveWinner({ ...validReplay, winner: 'p_unknown' }), 'draw');
console.log('✅ deriveWinner(winner id 找不到) === draw');

console.log('\n🎉 all smoke tests passed');
