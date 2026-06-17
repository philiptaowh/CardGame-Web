// batch-100.cjs — P0 修复后统计稳定性测试
//
// 配置：144 局（36 unordered character pairs × 4 policy/seed 组合）
// 4 组合：balanced/balanced, aggressive/aggressive, conservative/conservative, balanced/aggressive
// 目的：验证 P0 修复在统计层面稳定，搜索残余死循环
//
// 验收：
//   - 每局 total_moves < 250
//   - 每局 special_uses < 30
//   - 移动平均/中位数 < 修复前 batch-141 的对应指标
//   - 无新异常局（双方 HP=0 判平局）

const path = require('path');
const fs = require('fs');
const projectRoot = path.resolve(__dirname, '..');

const { runGame } = require(path.join(projectRoot, 'dist-engine/simulator/gameRunner'));
const { RuleBasedAI } = require(path.join(projectRoot, 'dist-engine/ai/ruleBasedAI'));
const { getPresetParams } = require(path.join(projectRoot, 'dist-engine/ai/interfaces'));

const charName = { char_1: '平衡', char_2: '防御', char_3: '进攻', char_4: '强化', char_5: '先手', char_6: '持久', char_7: '弱化', char_8: '反击', char_9: '连击' };
const charHP = { char_1: 100, char_2: 135, char_3: 80, char_4: 110, char_5: 90, char_6: 115, char_7: 80, char_8: 105, char_9: 90 };

const POLICY_CONFIGS = [
  { p1: 'balanced',      p2: 'balanced' },
  { p1: 'aggressive',    p2: 'aggressive' },
  { p1: 'conservative',  p2: 'conservative' },
  { p1: 'balanced',      p2: 'aggressive' },
];

// 36 unordered char pairs
const pairs = [];
for (let a = 1; a <= 9; a++) {
  for (let b = a; b <= 9; b++) {
    pairs.push([a, b]);
  }
}

const EXP_SEED = 20260609;
const outDir = path.join(projectRoot, 'data/raw/manual-review');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, '2026-06-09_batch-144.jsonl');

const lines = [];
const stats = [];

let totalStart = Date.now();

POLICY_CONFIGS.forEach((pcfg, pIdx) => {
  pairs.forEach(([a, b]) => {
    const idx = stats.length;
    const charId1 = `char_${a}`;
    const charId2 = `char_${b}`;
    const replay = runGame({
      charId1, charId2,
      policy1: new RuleBasedAI(pcfg.p1, getPresetParams(pcfg.p1)),
      policy2: new RuleBasedAI(pcfg.p2, getPresetParams(pcfg.p2)),
      experimentSeed: EXP_SEED, matchIndex: idx, recordMoves: true,
    });
    lines.push(JSON.stringify(replay));

    const totalMoves = replay.moves.length;
    const specialUses = replay.moves.filter(m => m.action?.type === 'use_special_card').length;
    const c0Uses = replay.moves.filter(m => m.action?.type === 'use_special_card' && m.action?.cardIndex === 0).length;
    const passCount = replay.moves.filter(m => m.action?.type === 'pass').length;
    const turns = replay.finalState.turn;
    const movesPerTurn = (totalMoves / Math.max(1, turns)).toFixed(2);
    const isDraw = replay.winner === null;
    const winnerText = isDraw ? '⚠️DRAW' : (replay.winner === 'player_1' ? charName[charId1] : charName[charId2]);

    stats.push({
      idx, matchup: charName[charId1] + ' vs ' + charName[charId2],
      policy: pcfg.p1 + '/' + pcfg.p2,
      totalMoves, specialUses, c0Uses, passCount, turns,
      movesPerTurn, isDraw, winner: winnerText, seed: replay.seed,
    });
  });
});

const totalDur = ((Date.now() - totalStart) / 1000).toFixed(2);
fs.writeFileSync(outFile, lines.join('\n') + '\n');

// ==================== 汇总 ====================
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const avg = (arr) => (arr.length > 0 ? sum(arr) / arr.length : 0);
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const max = (arr) => arr.length > 0 ? Math.max(...arr) : 0;
const min = (arr) => arr.length > 0 ? Math.min(...arr) : 0;

const totalMovesArr = stats.map(s => s.totalMoves);
const specialArr = stats.map(s => s.specialUses);
const turnsArr = stats.map(s => s.turns);
const c0Arr = stats.map(s => s.c0Uses);

const draws = stats.filter(s => s.isDraw).length;
const looped = stats.filter(s => s.totalMoves > 250).length;
const highSpecial = stats.filter(s => s.specialUses > 30).length;
const highC0Ratio = stats.filter(s => s.specialUses > 0 && (s.c0Uses / s.specialUses) > 0.95).length;

console.log('══════════════════════════════════════════════════════════════════');
console.log('  P0 修复后 — 144 局统计稳定性测试');
console.log('══════════════════════════════════════════════════════════════════');
console.log('');
console.log('配置: 36 unordered matchup × 4 policy 组合 = 144 局');
console.log('耗时:', totalDur + 's');
console.log('输出:', outFile);
console.log('');
console.log('──────────────────────────────────────────────────────────────────');
console.log('  关键指标                avg    median   min    max');
console.log('──────────────────────────────────────────────────────────────────');
console.log('  total_moves/局         ' + avg(totalMovesArr).toFixed(1).padStart(5) + '  ' + median(totalMovesArr).toFixed(0).padStart(5) + '   ' + min(totalMovesArr).toString().padStart(4) + '  ' + max(totalMovesArr).toString().padStart(4));
console.log('  special_uses/局        ' + avg(specialArr).toFixed(1).padStart(5) + '  ' + median(specialArr).toFixed(0).padStart(5) + '   ' + min(specialArr).toString().padStart(4) + '  ' + max(specialArr).toString().padStart(4));
console.log('  c0_uses/局             ' + avg(c0Arr).toFixed(1).padStart(5) + '  ' + median(c0Arr).toFixed(0).padStart(5) + '   ' + min(c0Arr).toString().padStart(4) + '  ' + max(c0Arr).toString().padStart(4));
console.log('  turns/局               ' + avg(turnsArr).toFixed(1).padStart(5) + '  ' + median(turnsArr).toFixed(0).padStart(5) + '   ' + min(turnsArr).toString().padStart(4) + '  ' + max(turnsArr).toString().padStart(4));
console.log('');
console.log('──────────────────────────────────────────────────────────────────');
console.log('  异常检测:');
console.log('    平局 (双方 HP=0)        : ' + draws + ' 局 (修复前 0/M9 是平局)');
console.log('    total_moves > 250     : ' + looped + ' 局 (死循环嫌疑)');
console.log('    special_uses > 30     : ' + highSpecial + ' 局');
console.log('    c0/special > 95%      : ' + highC0Ratio + ' 局');
console.log('──────────────────────────────────────────────────────────────────');
console.log('');

// 列出最异常的 5 局（按 total_moves 降序）
if (looped > 0 || highSpecial > 0) {
  console.log('最异常的 5 局（按 total_moves 降序）:');
  const top = [...stats].sort((a, b) => b.totalMoves - a.totalMoves).slice(0, 5);
  top.forEach(s => {
    console.log(`  [M${s.idx}] ${s.matchup} (${s.policy}) total=${s.totalMoves} special=${s.specialUses} c0=${s.c0Uses} turns=${s.turns} winner=${s.winner}`);
  });
} else {
  console.log('✅ 无异常局');
}
