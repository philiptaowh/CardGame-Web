// CLI — 贝叶斯优化入口
// V2.1.1 Phase 2
//
// 用法：
//   node dist-engine/optimization/cli.js optimize --char char_9 --budget 50 --output data/optimization/char_9.jsonl
//   node dist-engine/optimization/cli.js optimize-all --budget 50 --output data/optimization/all-chars.jsonl
//
// 内部 spawn Python 跑 bo_runner.py；Python 再 spawn Node 跑评估。

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Python 环境（与 analysis/cli.ts 一致）
const AOLA_PYTHON = 'C:\\ProgramData\\anaconda3\\envs\\aola-project\\python.exe';
const PYTORCH_PYTHON = 'C:\\ProgramData\\anaconda3\\envs\\pytorch_gpu\\python.exe';

function getPythonEnv(): string {
  if (fs.existsSync(AOLA_PYTHON)) return AOLA_PYTHON;
  if (fs.existsSync(PYTORCH_PYTHON)) return PYTORCH_PYTHON;
  return 'python';
}

function projectRoot(): string {
  return path.resolve(__dirname, '..', '..', '..');
}

function printUsage(): void {
  console.log(`
V2.1.1 Phase 2 — 贝叶斯优化 CLI

用法:
  node dist-engine/optimization/cli.js optimize --char <charId> [选项]
  node dist-engine/optimization/cli.js optimize-all [选项]

选项 (optimize):
  --char <id>           角色 ID (char_1 ~ char_9)
  --budget <N>          总评估次数 (默认 50)
  --n-initial <N>       初始随机采样数 (默认 20)
  --seed <N>            随机种子 (默认 42)
  --opponents <csv>     对手角色列表 (默认 9 角色全部)
  --policies <csv>      对手策略池 (默认 6 个)
  --output <path>       评估历史 JSONL 路径
  --early-stop-patience <N>  早停耐心 (默认 15)
  --early-stop-tol <f>  早停容差 (默认 0.005)
  --library <name>      BO 库 (默认 skopt)

示例:
  node dist-engine/optimization/cli.js optimize --char char_9 --budget 50 --output data/optimization/char_9.jsonl
  node dist-engine/optimization/cli.js optimize-all --budget 30 --output data/optimization/all.jsonl
`);
}

async function optimizeOne(args: string[]): Promise<void> {
  const python = getPythonEnv();
  const script = path.join(projectRoot(), 'analysis', 'bo_runner.py');
  if (!fs.existsSync(script)) {
    console.error(`错误: 找不到 ${script}`);
    process.exit(1);
  }

  console.log(`[optimize] Python: ${python}`);
  console.log(`[optimize] 脚本: ${script}`);

  const child = spawn(python, [script, ...args], {
    cwd: projectRoot(),
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    stdio: 'inherit',
  });

  await new Promise<void>((resolve) => {
    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`[optimize] 异常退出 (code=${code})`);
        process.exit(code ?? 1);
      }
      resolve();
    });
  });
}

async function optimizeAll(args: string[]): Promise<void> {
  // 串行优化 9 角色
  for (let i = 1; i <= 9; i++) {
    const charId = `char_${i}`;
    const charArgs = ['--char', charId, ...args];
    console.log(`\n═══ 优化 ${charId} ═══`);
    await optimizeOne(charArgs);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    return;
  }

  const command = args[0];
  const restArgs = args.slice(1);

  switch (command) {
    case 'optimize':
      await optimizeOne(restArgs);
      break;
    case 'optimize-all':
      await optimizeAll(restArgs);
      break;
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;
    default:
      console.error(`未知命令: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
