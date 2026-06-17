// regression-10.cjs — 修复后跑 10 局审查样本，验证 c0 占比 < 15%
//
// 与原 10 局样本配置一致：
//   M0: 平衡自打 (char_1 vs char_1)
//   M1-M9: 连击 vs 全部 9 角色
//   策略: balanced, 10 个不同 matchIndex
//   目标: 验证 use_special_card_c0 占比每局 < 15%

const path = require('path');
const fs = require('fs');
const projectRoot = path.resolve(__dirname, '..');

const { runGame } = require(path.join(projectRoot, 'dist-engine/simulator/gameRunner'));
const { RuleBasedAI } = require(path.join(projectRoot, 'dist-engine/ai/ruleBasedAI'));
const { getPresetParams } = require(path.join(projectRoot, 'dist-engine/ai/interfaces'));

const charName = { char_1: '平衡', char_2: '防御', char_3: '进攻', char_4: '强化', char_5: '先手', char_6: '持久', char_7: '弱化', char_8: '反击', char_9: '连击' };
const charHP = { char_1: 100, char_2: 135, char_3: 80, char_4: 110, char_5: 90, char_6: 115, char_7: 80, char_8: 105, char_9: 90 };

const matchups = [
  ['char_1', 'char_1'],
  ['char_9', 'char_1'], ['char_9', 'char_2'], ['char_9', 'char_3'],
  ['char_9', 'char_4'], ['char_9', 'char_5'], ['char_9', 'char_6'],
  ['char_9', 'char_7'], ['char_9', 'char_8'], ['char_9', 'char_9'],
];

const expSeed = 20260608;
const outDir = path.join(projectRoot, 'data/raw/manual-review');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, '2026-06-09_regression-10.jsonl');

const lines = [];
const results = [];

console.log('══════════════════════════════════════════════════════════════════');
console.log('  P0 死循环修复 — 10 局回归测试');
console.log('  配置: M0 平衡自打 + M1-M9 连击 vs 9 角色 | 策略=balanced');
console.log('══════════════════════════════════════════════════════════════════\n');

matchups.forEach((pair, i) => {
  const replay = runGame({
    charId1: pair[0], charId2: pair[1],
    policy1: new RuleBasedAI('balanced', getPresetParams('balanced')),
    policy2: new RuleBasedAI('balanced', getPresetParams('balanced')),
    experimentSeed: expSeed, matchIndex: i, recordMoves: true,
  });
  lines.push(JSON.stringify(replay));

  // 统计 c0 占比
  const c0Count = replay.moves.filter(m =>
    m.action?.type === 'use_special_card' && m.action?.cardIndex === 0
  ).length;
  const specialCardCount = replay.moves.filter(m => m.action?.type === 'use_special_card').length;
  const c0Ratio = specialCardCount > 0 ? (c0Count / specialCardCount * 100) : 0;
  const passCount = replay.moves.filter(m => m.action?.type === 'pass').length;

  const p1 = replay.finalState.players[0];
  const p2 = replay.finalState.players[1];
  const winnerText = replay.winner === 'player_1' ? charName[pair[0]] + '胜'
    : (replay.winner === 'player_2' ? charName[pair[1]] + '胜' : '⚠️平局');

  results.push({
    idx: i, matchup: charName[pair[0]] + ' vs ' + charName[pair[1]],
    seed: replay.seed, turns: replay.finalState.turn,
    c0Count, specialCardCount, c0Ratio, passCount,
    totalMoves: replay.moves.length,
    p1hp: p1.finalHP, p2hp: p2.finalHP, winner: winnerText,
  });
});

fs.writeFileSync(outFile, lines.join('\n') + '\n');

console.log('局号  matchup                       回合  总moves  special  c0次数  c0占比   pass次数  胜者');
console.log('─────────────────────────────────────────────────────────────────────────────────────────────────');
let acPass = true;
results.forEach(r => {
  const ratioPadded = (r.c0Ratio.toFixed(1) + '%').padStart(7);
  const ac = r.c0Ratio < 15 ? '✅' : '❌';
  if (r.c0Ratio >= 15) acPass = false;
  console.log(
    'M' + r.idx + '   ' +
    r.matchup.padEnd(28) + '  ' +
    String(r.turns).padStart(3) + '   ' +
    String(r.totalMoves).padStart(5) + '   ' +
    String(r.specialCardCount).padStart(5) + '   ' +
    String(r.c0Count).padStart(5) + '   ' +
    ratioPadded + '   ' +
    String(r.passCount).padStart(5) + '   ' +
    r.winner + ' ' + ac
  );
});
console.log('');
console.log('══════════════════════════════════════════════════════════════════');
console.log('  AC4 验收: c0 占比每局 < 15%');
console.log('  结果:   ' + (acPass ? '✅ 全部通过' : '❌ 有局未达标'));
console.log('══════════════════════════════════════════════════════════════════');
console.log('');
console.log('输出文件: ' + outFile);
