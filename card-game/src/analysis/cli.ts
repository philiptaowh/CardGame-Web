// 分析 CLI 桥接 — 调用 Python 分析引擎
// V2.1.0 分析平台
//
// 通过 child_process.spawn 调用 pytorch_gpu 环境的 Python
// 执行 analysis/main.py 完成统计计算和 HTML 报告生成

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { AnalysisOptions, AnalysisResult } from './types';

/** Python 环境配置 */
const GPU_PYTHON = 'C:\\ProgramData\\anaconda3\\envs\\pytorch_gpu\\python.exe';
const CPU_PYTHON = 'C:\\ProgramData\\anaconda3\\envs\\aola-project\\python.exe';

/** 项目根目录（analysis/main.py 所在位置） */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function getPythonEnv(gpu: boolean): string {
  if (gpu && fs.existsSync(GPU_PYTHON)) {
    return GPU_PYTHON;
  }
  // fallback to CPU python
  if (fs.existsSync(CPU_PYTHON)) {
    return CPU_PYTHON;
  }
  return 'python'; // 系统 PATH
}

function getPythonEnvName(pythonPath: string): string {
  if (pythonPath.includes('pytorch_gpu')) return 'pytorch_gpu (GPU)';
  if (pythonPath.includes('aola-project')) return 'aola-project (CPU)';
  return 'system python';
}

/**
 * 运行 Python 分析引擎
 *
 * 调用方式:
 *   python analysis/main.py <jsonl-file> [--gpu] [--output <path>] [--no-report]
 */
export function runAnalysis(options: AnalysisOptions): Promise<AnalysisResult> {
  const startTime = Date.now();
  const pythonPath = getPythonEnv(options.gpu ?? false);

  // 将用户传入的路径解析为绝对路径（Python 的 cwd 是 PROJECT_ROOT）
  const absoluteJsonlPath = path.resolve(process.cwd(), options.jsonlFile);

  // 构建 Python 参数
  const pyArgs: string[] = [
    path.join(PROJECT_ROOT, 'analysis', 'main.py'),
    absoluteJsonlPath,
  ];

  if (options.gpu) {
    pyArgs.push('--gpu');
  }
  if (options.output) {
    pyArgs.push('--output', options.output);
  }
  if (options.maxGames !== undefined) {
    pyArgs.push('--max-games', String(options.maxGames));
  }
  if (options.noReport) {
    pyArgs.push('--no-report');
  }

  // 构建 PYTHONPATH
  const env = {
    ...process.env,
    PYTHONPATH: PROJECT_ROOT,
    PYTHONIOENCODING: 'utf-8',
  };

  return new Promise((resolve) => {
    const child = spawn(pythonPath, pyArgs, {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
      process.stdout.write(data); // 实时输出到终端
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
      process.stderr.write(data);
    });

    child.on('close', (exitCode) => {
      const duration = (Date.now() - startTime) / 1000;

      // 从 stdout 提取报告路径
      let reportPath: string | null = null;
      const reportMatch = stdout.match(/HTML 报告: (.+\.html)/);
      if (reportMatch) {
        reportPath = reportMatch[1].trim();
      }

      // 从 stdout 提取总对局数
      let totalGames = 0;
      const gamesMatch = stdout.match(/已加载 (\d+) 局/);
      if (gamesMatch) {
        totalGames = parseInt(gamesMatch[1], 10);
      }

      if (exitCode !== 0) {
        console.error(`\n[错误] Python 分析引擎异常退出 (code=${exitCode})`);
        if (stderr) {
          console.error(stderr);
        }
      }

      resolve({
        reportPath,
        totalGames,
        duration,
        pythonEnv: getPythonEnvName(pythonPath),
        exitCode: exitCode ?? -1,
      });
    });
  });
}

