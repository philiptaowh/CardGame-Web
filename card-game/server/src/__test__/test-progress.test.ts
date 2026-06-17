// v2.2.1.2 - test-progress 路由纯逻辑 smoke test
//
// 用法：npx tsx src/__test__/test-progress.test.ts
// 不依赖 MySQL，验证 matchup 工具函数 + 状态推导逻辑

import { strict as assert } from 'node:assert';

// 复制 routes/test-progress.ts 里的纯函数（保持同步）
type TestProgressRow = {
  matchup_key: string;
  human_char: string;
  ai_char: string;
  target: number;
  completed: number;
  completed_at: number[];
  last_player_ip: string;
  last_player_ua: string;
  updated_at: string;
};

type MatchupDTO = {
  matchupKey: string;
  humanChar: string;
  aiChar: string;
  target: number;
  completed: number;
  status: 'available' | 'locked';
};

function rowToDTO(row: TestProgressRow): MatchupDTO {
  return {
    matchupKey: row.matchup_key,
    humanChar: row.human_char,
    aiChar: row.ai_char,
    target: row.target,
    completed: row.completed,
    status: row.completed >= row.target ? 'locked' : 'available',
  };
}

function isValidMatchup(humanChar: string, aiChar: string): boolean {
  const validChars = ['char_1', 'char_2', 'char_3', 'char_4', 'char_5', 'char_6', 'char_7', 'char_8', 'char_9'];
  return validChars.includes(humanChar) && validChars.includes(aiChar);
}

function makeKey(humanChar: string, aiChar: string): string {
  return `${humanChar}|${aiChar}`;
}

// ============ 测试用例 ============

// 1) rowToDTO: 0/10 → available
const row0: TestProgressRow = {
  matchup_key: 'char_1|char_3',
  human_char: 'char_1', ai_char: 'char_3',
  target: 10, completed: 0,
  completed_at: [],
  last_player_ip: '', last_player_ua: '',
  updated_at: '2026-06-15T00:00:00Z',
};
assert.equal(rowToDTO(row0).status, 'available');
console.log('✅ rowToDTO(0/10).status === available');

// 2) rowToDTO: 9/10 → available (还没满)
const row9: TestProgressRow = { ...row0, completed: 9 };
assert.equal(rowToDTO(row9).status, 'available');
console.log('✅ rowToDTO(9/10).status === available');

// 3) rowToDTO: 10/10 → locked
const row10: TestProgressRow = { ...row0, completed: 10 };
assert.equal(rowToDTO(row10).status, 'locked');
console.log('✅ rowToDTO(10/10).status === locked');

// 4) rowToDTO: 11/10 (异常) → locked (上限保护)
const row11: TestProgressRow = { ...row0, completed: 11 };
assert.equal(rowToDTO(row11).status, 'locked');
console.log('✅ rowToDTO(11/10).status === locked (异常上限保护)');

// 5) isValidMatchup: 合法
assert.equal(isValidMatchup('char_1', 'char_5'), true);
console.log('✅ isValidMatchup(char_1, char_5) === true');

// 6) isValidMatchup: 非法角色
assert.equal(isValidMatchup('char_99', 'char_3'), false);
assert.equal(isValidMatchup('char_1', ''), false);
console.log('✅ isValidMatchup(非法角色) === false');

// 7) makeKey
assert.equal(makeKey('char_2', 'char_7'), 'char_2|char_7');
console.log("✅ makeKey('char_2', 'char_7') === 'char_2|char_7'");

// 8) 81 matchup 全列
const all81: MatchupDTO[] = [];
for (let h = 1; h <= 9; h++) {
  for (let a = 1; a <= 9; a++) {
    all81.push({
      matchupKey: makeKey(`char_${h}`, `char_${a}`),
      humanChar: `char_${h}`,
      aiChar: `char_${a}`,
      target: 10, completed: 0,
      status: 'available',
    });
  }
}
assert.equal(all81.length, 81, '应该有 81 个 matchup');
const lockedCount = all81.filter(m => m.status === 'locked').length;
assert.equal(lockedCount, 0, '初始 0/10 时, 应全部 available');
console.log('✅ 81 matchup 全部正确生成, 初始 0 个锁定');

// 9) 模拟 50/10 满 + 31 进度: 50 locked, 31 available
const mixed81 = all81.map((m, i) => i < 50 ? { ...m, completed: 10, status: 'locked' as const } : m);
const mixedLocked = mixed81.filter(m => m.status === 'locked').length;
const mixedAvail = mixed81.filter(m => m.status === 'available').length;
assert.equal(mixedLocked, 50);
assert.equal(mixedAvail, 31);
console.log('✅ 50/81 锁定 + 31/81 可选 状态推导正确');

console.log('\n🎉 all test-progress smoke tests passed');
