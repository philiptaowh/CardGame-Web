// clean-batch.cjs — P0 修复后的干净大批次（5000-7000 局）
// 36 unordered pairs × 5 policies × 4 seeds = 3600 局
// 加 1 个 9 角色自打（9 × 5 policies × 4 seeds = 180）= 3780 局
// 再加 9 char × 9 opp ordered × 3 policies × 3 seeds = 2187 局
// 总 ≈ 6000 局
const path = require('path');
const fs = require('fs');
const projectRoot = path.resolve(__dirname, '..');

const { runGame } = require(path.join(projectRoot, 'dist-engine/simulator/gameRunner'));
const { RuleBasedAI } = require(path.join(projectRoot, 'dist-engine/ai/ruleBasedAI'));
const { getPresetParams } = require(path.join(projectRoot, 'dist-engine/ai/interfaces'));

const POLICIES = ['balanced', 'aggressive', 'conservative', 'controller', 'burst', 'endurance', 'gambler'];
const SEEDS = [20260610, 20260611, 20260612, 20260613];

const outDir = path.join(projectRoot, 'data/raw');
const outFile = path.join(outDir, '2026-06-10_clean-batch.jsonl');
fs.mkdirSync(outDir, { recursive: true });

// 36 unordered pairs + 9 self
const pairs = [];
for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) pairs.push([a, b]);

const lines = [];
let idx = 0;
const start = Date.now();
const totalEst = 45 * POLICIES.length * POLICIES.length * SEEDS.length;

for (const [a, b] of pairs) {
  for (const p1Policy of POLICIES) {
    for (const p2Policy of POLICIES) {
      for (const seed of SEEDS) {
        const charId1 = `char_${a}`, charId2 = `char_${b}`;
        const replay = runGame({
          charId1, charId2,
          policy1: new RuleBasedAI(p1Policy, getPresetParams(p1Policy)),
          policy2: new RuleBasedAI(p2Policy, getPresetParams(p2Policy)),
          experimentSeed: seed, matchIndex: idx, recordMoves: false,
        });
        lines.push(JSON.stringify({
          idx, seed, char1: charId1, char2: charId2,
          p1: p1Policy, p2: p2Policy,
          winner: replay.winner,
          turns: replay.finalState.turn,
        }));
        idx++;
        if (idx % 100 === 0) {
          const elapsed = ((Date.now() - start) / 1000).toFixed(0);
          const eta = (elapsed / idx * (totalEst - idx)).toFixed(0);
          process.stdout.write(`\r[clean-batch] ${idx}/${totalEst} 局 / ${elapsed}s / 剩 ${eta}s`);
        }
      }
    }
  }
}

fs.writeFileSync(outFile, lines.join('\n') + '\n');
const totalDur = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n[clean-batch] 完成: ${idx} 局, 耗时 ${totalDur}s`);
console.log(`[clean-batch] 输出: ${outFile}`);
