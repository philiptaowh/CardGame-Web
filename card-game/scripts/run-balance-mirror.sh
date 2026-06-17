#!/usr/bin/env bash
# run-balance-mirror.sh — 平衡自打单局脚本（随机种子）
#
# 用途：跑 1 局 char_1 vs char_1，策略=balanced，recordMoves=true
#       输出到 data/raw/manual-review/，便于人工审查
#
# 用法：
#   ./scripts/run-balance-mirror.sh                # 使用时间戳随机种子
#   ./scripts/run-balance-mirror.sh <seed>         # 指定种子（可复现）
#   ./scripts/run-balance-mirror.sh <seed> <out>   # 指定输出文件路径
#
# 依赖：dist-engine/simulator/gameRunner.js（已编译）

set -euo pipefail

# 切到 card-game 根目录（脚本可在任意路径执行）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARD_GAME_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${CARD_GAME_ROOT}"

# 解析参数
SEED="${1:-$(date +%s)}"
OUT_FILE="${2:-}"

# 默认输出路径
OUT_DIR="./data/raw/manual-review"
TS=$(date +%Y%m%d_%H%M%S)
if [ -z "${OUT_FILE}" ]; then
  OUT_FILE="${OUT_DIR}/balance-mirror_${TS}_seed${SEED}.jsonl"
fi

# 确保输出目录存在
mkdir -p "$(dirname "${OUT_FILE}")"

# 跑单局（通过 node 复用已编译的 gameRunner）
node -e "
const { runGame } = require('./dist-engine/simulator/gameRunner');
const { RuleBasedAI } = require('./dist-engine/ai/ruleBasedAI');
const { getPresetParams } = require('./dist-engine/ai/interfaces');
const fs = require('fs');

const replay = runGame({
  charId1: 'char_1',
  charId2: 'char_1',
  policy1: new RuleBasedAI('balanced', getPresetParams('balanced')),
  policy2: new RuleBasedAI('balanced', getPresetParams('balanced')),
  experimentSeed: ${SEED},
  matchIndex: 0,
  recordMoves: true,
});

fs.writeFileSync('${OUT_FILE}', JSON.stringify(replay) + '\n');

const p1 = replay.finalState.players[0];
const p2 = replay.finalState.players[1];
const winnerText = replay.winner === 'player_1' ? 'P1 胜' : (replay.winner === 'player_2' ? 'P2 胜' : '平局');

console.log('═══════════════════════════════════════════');
console.log('  平衡自打 (char_1 vs char_1)');
console.log('  种子(派生):  ' + replay.seed);
console.log('  实验种子:    ' + ${SEED});
console.log('  回合数:      ' + replay.finalState.turn);
console.log('  动作数:      ' + replay.moves.length);
console.log('  耗时:        ' + replay.duration + 'ms');
console.log('  结果:        ' + winnerText);
console.log('  P1 终局:     HP=' + p1.finalHP + '/100  盾=' + p1.finalShield);
console.log('  P2 终局:     HP=' + p2.finalHP + '/100  盾=' + p2.finalShield);
console.log('═══════════════════════════════════════════');
console.log('  输出: ${OUT_FILE}');
console.log('');
console.log('  回放命令:');
console.log('    ./scripts/replay-match.sh \"' + '${OUT_FILE}' + '\"');
"

# 打印文件大小
echo "文件大小: $(du -h "${OUT_FILE}" | cut -f1)"
