// evaluate-theta.cjs — 单 θ 评估脚本
//
// 跑 N 局（默认 54 局 = 9 角色 × 6 策略），返回胜率 JSON 到 stdout
// 用于 Phase 2 贝叶斯优化：每评估 1 个 θ，由 Python spawn 调用
//
// 用法：
//   node evaluate-theta.cjs \
//     --char char_9 \
//     --params '{"priority":0.5,"hp_danger":0.3,"aggro":0.5,"mark_weight":1.0,"special_threshold":0.5}' \
//     --opponents 'char_1,char_2,char_3,char_4,char_5,char_6,char_7,char_8,char_9' \
//     --policies 'balanced,aggressive,conservative,controller,burst,endurance' \
//     --seed 42

const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

const { runGame } = require(path.join(projectRoot, 'dist-engine/simulator/gameRunner'));
const { RuleBasedAI } = require(path.join(projectRoot, 'dist-engine/ai/ruleBasedAI'));
const { getPresetParams, getOptimalParams } = require(path.join(projectRoot, 'dist-engine/ai/interfaces'));

// 解析命令行参数
function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1];
      if (val && !val.startsWith('--')) {
        opts[key] = val;
        i++;
      } else {
        opts[key] = true;
      }
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (!opts.char) {
  console.error('用法: node evaluate-theta.cjs --char <charId> [--params <JSON>|--use-optimal] [--opponents <csv>] [--policies <csv>] [--seed <n>]');
  process.exit(1);
}

const charId = opts.char;
let params;
if (opts['use-optimal']) {
  const opt = getOptimalParams(charId);
  if (!opt) {
    console.error(`错误: 找不到 ${charId} 的最优参数`);
    process.exit(1);
  }
  params = opt;
  console.error(`[评估] 使用 ${charId} 的 BO 最优参数`);
} else if (opts.params) {
  params = JSON.parse(opts.params);
} else {
  console.error('错误: 请指定 --params <JSON> 或 --use-optimal');
  process.exit(1);
}
const opponents = (opts.opponents || 'char_1,char_2,char_3,char_4,char_5,char_6,char_7,char_8,char_9').split(',');
const policies = (opts.policies || 'balanced,aggressive,conservative,controller,burst,endurance').split(',');
const baseSeed = parseInt(opts.seed || '0', 10) || 0;

// 固定 θ 中的非优化参数（仅当 params 缺省时用默认值）
const fixedParams = {
  wild: params.wild ?? 'bal',
  skill_pref: params.skill_pref ?? [0.25, 0.25, 0.25, 0.25],
  noise: params.noise ?? 0.0,
  ...params,  // 用户参数覆盖
};

// 构造对手策略（每次复用）
const opponentPolicies = policies.map(name => ({
  name,
  policy: new RuleBasedAI(name, getPresetParams(name)),
}));

// 跑 N 局：每个 (opponent_char, opponent_policy) 一局
const startTime = Date.now();
let wins = 0, draws = 0, losses = 0;
let matchIndex = 0;

opponents.forEach((oppChar) => {
  opponentPolicies.forEach(({ name: oppPolicyName, policy: oppPolicy }) => {
    const seed = baseSeed + matchIndex;
    const replay = runGame({
      charId1: charId,
      charId2: oppChar,
      policy1: new RuleBasedAI('target', fixedParams),
      policy2: oppPolicy,
      experimentSeed: seed,
      matchIndex: matchIndex,
      recordMoves: false,  // 评估不需要 moves，节省内存
    });

    if (replay.winner === 'player_1') wins++;
    else if (replay.winner === 'player_2') losses++;
    else draws++;
    matchIndex++;
  });
});

const durationMs = Date.now() - startTime;
const totalMatches = wins + draws + losses;
const winrate = totalMatches > 0 ? (wins + 0.5 * draws) / totalMatches : 0;

// 输出 JSON 到 stdout
const result = {
  char: charId,
  params: fixedParams,
  total_matches: totalMatches,
  wins, draws, losses,
  winrate: parseFloat(winrate.toFixed(6)),
  duration_ms: durationMs,
  opponents,
  policies,
  base_seed: baseSeed,
};
process.stdout.write(JSON.stringify(result) + '\n');
