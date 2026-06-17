// replay-match.cjs — 对局回放脚本（跨平台 Node.js 版本）
//
// 用途：包装 dist-engine/simulator/cli.js 的 replay 子命令
//       把 JSONL 文件中的某一局以人类可读文本形式输出
//
// 用法：
//   node scripts/replay-match.cjs <jsonl-file>                     # 回放第 0 局
//   node scripts/replay-match.cjs <jsonl-file> --index N           # 回放第 N 局（从 0 开始）
//   node scripts/replay-match.cjs <jsonl-file> --last              # 回放最后一局
//
// 依赖：dist-engine/simulator/cli.js（已编译）

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

// 参数透传给 cli（去掉 node 和脚本名）
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('用法: node scripts/replay-match.cjs <jsonl-file> [--index N | --last]');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/replay-match.cjs data/raw/manual-review/2026-06-08_sample-10.jsonl');
  console.log('  node scripts/replay-match.cjs data/raw/manual-review/2026-06-08_sample-10.jsonl --index 0');
  console.log('  node scripts/replay-match.cjs data/raw/manual-review/2026-06-08_sample-10.jsonl --last');
  process.exit(1);
}

// 校验文件存在
const jsonlFile = args[0];
if (!fs.existsSync(jsonlFile)) {
  console.error('错误: 文件不存在: ' + jsonlFile);
  process.exit(1);
}

// 透传给 cli replay
const cliPath = path.join(projectRoot, 'dist-engine/simulator/cli.js');
const child = spawn(process.execPath, [cliPath, 'replay', ...args], {
  cwd: projectRoot,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
