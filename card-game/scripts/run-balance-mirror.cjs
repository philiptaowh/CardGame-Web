// run-balance-mirror.cjs — 平衡自打单局脚本（跨平台 Node.js 版本）
//
// 用途：跑 1 局 char_1 vs char_1，策略=balanced，recordMoves=true
//       输出到 data/raw/manual-review/，便于人工审查
//
// 用法：
//   node scripts/run-balance-mirror.cjs                     # 使用 Unix 时间戳随机种子
//   node scripts/run-balance-mirror.cjs <seed>              # 指定种子（可复现）
//   node scripts/run-balance-mirror.cjs <seed> <outFile>    # 指定输出文件路径
//
// 依赖：dist-engine/simulator/gameRunner.js（已编译）

const path = require('path');
const fs = require('fs');
const projectRoot = path.resolve(__dirname, '..');

// 解析位置参数
const seed = parseInt(process.argv[2] || '0', 10) || Math.floor(Date.now() / 1000);
const customOutFile = process.argv[3];

// 默认输出路径
const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14); // YYYYMMDD_HHMMSS
const defaultOutFile = path.join(
  projectRoot,
  'data', 'raw', 'manual-review',
  `balance-mirror_${ts}_seed${seed}.jsonl`
);
const outFile = customOutFile ? path.resolve(customOutFile) : defaultOutFile;

// 确保输出目录存在
fs.mkdirSync(path.dirname(outFile), { recursive: true });

// 加载已编译的 gameRunner
const { runGame } = require(path.join(projectRoot, 'dist-engine/simulator/gameRunner'));
const { RuleBasedAI } = require(path.join(projectRoot, 'dist-engine/ai/ruleBasedAI'));
const { getPresetParams } = require(path.join(projectRoot, 'dist-engine/ai/interfaces'));

// 跑单局
const replay = runGame({
  charId1: 'char_1',
  charId2: 'char_1',
  policy1: new RuleBasedAI('balanced', getPresetParams('balanced')),
  policy2: new RuleBasedAI('balanced', getPresetParams('balanced')),
  experimentSeed: seed,
  matchIndex: 0,
  recordMoves: true,
});

// 写入 JSONL
fs.writeFileSync(outFile, JSON.stringify(replay) + '\n');

// 打印中文元信息（与 .sh 版本输出格式一致）
const p1 = replay.finalState.players[0];
const p2 = replay.finalState.players[1];
const winnerText = replay.winner === 'player_1' ? 'P1 胜'
  : (replay.winner === 'player_2' ? 'P2 胜' : '平局');

console.log('═══════════════════════════════════════════');
console.log('  平衡自打 (char_1 vs char_1)');
console.log('  种子(派生):  ' + replay.seed);
console.log('  实验种子:    ' + seed);
console.log('  回合数:      ' + replay.finalState.turn);
console.log('  动作数:      ' + replay.moves.length);
console.log('  耗时:        ' + replay.duration + 'ms');
console.log('  结果:        ' + winnerText);
console.log('  P1 终局:     HP=' + p1.finalHP + '/100  盾=' + p1.finalShield);
console.log('  P2 终局:     HP=' + p2.finalHP + '/100  盾=' + p2.finalShield);
console.log('═══════════════════════════════════════════');
console.log('  输出: ' + outFile);
console.log('');
console.log('  回放命令:');
console.log('    node ' + path.relative(process.cwd(), path.join(__dirname, 'replay-match.cjs')) + ' "' + outFile + '"');
console.log('═══════════════════════════════════════════');

// 文件大小
const sizeBytes = fs.statSync(outFile).size;
console.log('文件大小: ' + sizeBytes + ' 字节');
