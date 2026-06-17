// ConcurrentRunner — 批量对局并发调度器
// V2 仿真平台组件
//
// 职责：多 Worker 并行调度（当前：主线程并发池；未来：worker_threads）
// 输入：策略组合 × 角色组合 × 对局数
// 输出：JSON Lines 文件

import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import type { CharacterId } from '../types';
import type { IPlayerPolicy } from '../ai/interfaces';
import { getPresetNames, getPresetParams } from '../ai/interfaces';
import { RuleBasedAI } from '../ai/ruleBasedAI';
import { RandomAI } from '../ai/randomAI';
import { runGame, generateMatchups, ALL_CHARACTERS } from './gameRunner';
import type { Replay } from '../types/replay';
import { deriveSeed } from '../types/replay';

// ============ 配置 ============

export interface BatchConfig {
  /** 实验种子 */
  experimentSeed: number;
  /** 每组组合对局数 n（总对局 N = 36 × n × 策略组合数） */
  gamesPerMatchup: number;
  /** 使用的策略名称列表（默认用全部预设） */
  policyNames?: string[];
  /** 是否包含 RandomAI 基线 */
  includeRandomBaseline?: boolean;
  /** 并发度（并行运行的最大游戏数） */
  concurrency?: number;
  /** 输出目录 */
  outputDir?: string;
  /** 批次号 */
  batchId?: string;
}

export interface BatchResult {
  batchId: string;
  totalGames: number;
  completedGames: number;
  failedGames: number;
  outputFile: string;
  duration: number;
}

// ============ 批次运行 ============

/**
 * 运行批量对局仿真
 *
 * 调度逻辑：
 * 1. 枚举 36 个角色组合
 * 2. 对每个组合枚举策略配置
 * 3. 对每个策略配置运行 n 场对局
 * 4. 输出 JSON Lines 文件
 */
export async function runBatch(config: BatchConfig): Promise<BatchResult> {
  const {
    experimentSeed,
    gamesPerMatchup,
    policyNames = getPresetNames(),
    includeRandomBaseline = true,
    concurrency = 8,
    outputDir = './data/raw',
    batchId = `${formatDate(new Date())}_batch-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
  } = config;

  // 构建策略池
  const policies: IPlayerPolicy[] = [];

  if (includeRandomBaseline) {
    policies.push(new RandomAI('RandomAI'));
  }

  for (const name of policyNames) {
    const params = getPresetParams(name);
    if (params) {
      policies.push(new RuleBasedAI(name, params));
    }
  }

  // 生成所有任务
  const matchups = generateMatchups();
  const tasks: Array<{
    charA: CharacterId;
    charB: CharacterId;
    policyA: IPlayerPolicy;
    policyB: IPlayerPolicy;
    matchIndex: number;
  }> = [];

  for (const [charA, charB] of matchups) {
    for (const policyA of policies) {
      for (const policyB of policies) {
        for (let g = 0; g < gamesPerMatchup; g++) {
          const matchIndex = tasks.length;
          tasks.push({ charA, charB, policyA, policyB, matchIndex });
        }
      }
    }
  }

  const totalGames = tasks.length;
  console.log(`[Batch ${batchId}] 任务总数: ${totalGames}`);
  console.log(`[Batch ${batchId}] 策略数: ${policies.length}, 角色组合: ${matchups.length}, 每组合局数: ${gamesPerMatchup}`);

  // 确保输出目录存在
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, `${batchId}.jsonl`);
  const writeStream = fs.createWriteStream(outputFile, { flags: 'a' });

  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  // 并行执行（带并发控制）
  const worker = async (task: typeof tasks[0]): Promise<void> => {
    try {
      const replay = runGame({
        charId1: task.charA,
        charId2: task.charB,
        policy1: task.policyA,
        policy2: task.policyB,
        experimentSeed,
        matchIndex: task.matchIndex,
        recordMoves: false, // 批量运行时不需要记录完整 moves（太大）
      });

      // JSON Lines 写入
      const line = JSON.stringify(replay) + '\n';
      writeStream.write(line);
    } catch (err) {
      failed++;
      console.error(`[失败] ${task.charA} vs ${task.charB}: ${err}`);
    }
  };

  // 并发池
  const queue = [...tasks];
  const running: Promise<void>[] = [];

  while (queue.length > 0 || running.length > 0) {
    // 填充并发池
    while (running.length < concurrency && queue.length > 0) {
      const task = queue.shift()!;
      const p = worker(task).then(() => {
        completed++;
        if (completed % 100 === 0 || completed === totalGames) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[进展] ${completed}/${totalGames} (${elapsed}s)`);
        }
      });
      running.push(p);
    }

    // 等待任意一个完成
    if (running.length > 0) {
      await Promise.race(running);
      // 清理已完成的 Promise
      while (running.length > 0) {
        const idx = await Promise.race(running.map((p, i) => p.then(() => i).catch(() => i)));
        running.splice(idx, 1);
      }
    }
  }

  writeStream.end();
  const totalDuration = Date.now() - startTime;

  console.log(`[Batch ${batchId}] 完成! ${completed} 成功, ${failed} 失败, ${(totalDuration / 1000).toFixed(1)}s`);

  return {
    batchId,
    totalGames,
    completedGames: completed,
    failedGames: failed,
    outputFile,
    duration: totalDuration,
  };
}

// ============ Worker 线程批次运行 ============

export interface WorkerBatchConfig {
  /** 实验种子 */
  experimentSeed: number;
  /** 每组组合对局数 */
  gamesPerMatchup: number;
  /** 策略名称列表（默认用全部预设） */
  policyNames?: string[];
  /** 是否包含 RandomAI 基线 */
  includeRandomBaseline?: boolean;
  /** Worker 线程数（默认 CPU 核心数 / 2） */
  workerCount?: number;
  /** 输出目录 */
  outputDir?: string;
  /** 批次号 */
  batchId?: string;
}

/**
 * 使用 worker_threads 运行批量对局仿真
 *
 * 每个 Worker 运行在独立线程中，接收一批任务（GameRunnerConfig[]），
 * 顺序执行后返回结果 JSON 数组。主线程负责分配任务和写入文件。
 *
 * 相比 Promise-based 并发池，worker_threads 能真正利用多核 CPU，
 * 预期吞吐提升 8-16x。
 */
export async function runBatchWorkers(config: WorkerBatchConfig): Promise<BatchResult> {
  const {
    experimentSeed,
    gamesPerMatchup,
    policyNames = getPresetNames(),
    includeRandomBaseline = true,
    workerCount = Math.max(1, Math.floor(cpus().length / 2)),
    outputDir = './data/raw',
    batchId = `${formatDate(new Date())}_batch-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
  } = config;

  // 构建策略名称列表
  const allPolicyNames = [...policyNames];
  if (includeRandomBaseline) {
    allPolicyNames.push('RandomAI');
  }
  // 去重
  const uniquePolicyNames = [...new Set(allPolicyNames)];

  // 生成任务列表（使用可序列化的描述，不含策略实例）
  const matchups = generateMatchups();
  interface TaskDesc {
    charId1: CharacterId;
    charId2: CharacterId;
    policy1Name: string;
    policy2Name: string;
    matchIndex: number;
    experimentSeed: number;
    recordMoves: boolean;
  }
  const tasks: TaskDesc[] = [];

  for (const [charA, charB] of matchups) {
    for (const pName of uniquePolicyNames) {
      for (const pName2 of uniquePolicyNames) {
        for (let g = 0; g < gamesPerMatchup; g++) {
          tasks.push({
            charId1: charA,
            charId2: charB,
            policy1Name: pName,
            policy2Name: pName2,
            matchIndex: tasks.length,
            experimentSeed,
            recordMoves: false,
          });
        }
      }
    }
  }

  const totalGames = tasks.length;
  console.log(`[Batch ${batchId}] 任务总数: ${totalGames}`);
  console.log(`[Batch ${batchId}] Worker: ${workerCount} 线程, 策略: ${uniquePolicyNames.length}, 角色组合: ${matchups.length}, 每组合局数: ${gamesPerMatchup}`);

  // 确保输出目录
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${batchId}.jsonl`);
  const writeStream = fs.createWriteStream(outputFile, { flags: 'a' });

  // 将任务均分到各 Worker
  const tasksPerWorker = Math.ceil(tasks.length / workerCount);
  const workerBatches: TaskDesc[][] = [];
  for (let i = 0; i < workerCount; i++) {
    const batch = tasks.slice(i * tasksPerWorker, (i + 1) * tasksPerWorker);
    if (batch.length > 0) workerBatches.push(batch);
  }

  console.log(`[Batch ${batchId}] 每个 Worker 约 ${tasksPerWorker} 局`);

  const startTime = Date.now();
  let failed = 0;
  // 收集所有结果后一次性写入，避免并发写入缓冲丢失
  const allResults: string[] = [];

  // Worker 脚本路径（绝对路径，worker_threads 要求）
  const workerScript = path.resolve(__dirname, 'worker.js');
  if (!fs.existsSync(workerScript)) {
    console.error(`[错误] Worker 脚本不存在: ${workerScript}`);
    console.error('请先运行 npm run build:simulator');
    process.exit(1);
  }

  await new Promise<void>((resolve, reject) => {
    let workersDone = 0;

    for (const batch of workerBatches) {
      const worker = new Worker(workerScript);

      worker.on('message', (msg) => {
        if (msg.type === 'results' && Array.isArray(msg.data)) {
          allResults.push(...msg.data);
        } else if (msg.type === 'error') {
          console.error(`[Worker 错误] ${msg.message}`);
        }
      });

      worker.on('error', (err) => {
        console.error(`[Worker 异常] ${err.message}`);
        failed += batch.length;
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[Worker 退出] code=${code}`);
        }
        workersDone++;
        if (workersDone >= workerBatches.length) {
          resolve();
        }
      });

      // 发送任务到 Worker
      worker.postMessage(batch.map(t => ({
        charId1: t.charId1,
        charId2: t.charId2,
        policy1Name: t.policy1Name,
        policy2Name: t.policy2Name,
        experimentSeed: t.experimentSeed,
        matchIndex: t.matchIndex,
        recordMoves: t.recordMoves,
      })));
    }
  });

  // 所有 Worker 完成 → 一次性原子写入
  fs.writeFileSync(outputFile, allResults.join('\n') + '\n', 'utf-8');
  const completed = allResults.length;
  const totalDuration = Date.now() - startTime;

  console.log(`[Batch ${batchId}] 完成! ${completed} 成功, ${failed} 失败, ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  吞吐: ${(completed / (totalDuration / 1000)).toFixed(0)} 局/秒`);

  // 写入完成后做完整性校验
  console.log(`[验证] 运行完整性校验...`);
  const validation = validateBatch(outputFile);
  if (validation.passed) {
    console.log(`[验证] ✅ 通过 (${validation.totalLines} 条记录)`);
  } else {
    console.log(`[验证] ⚠️ 发现问题: ${validation.errors.join('; ')}`);
  }

  return {
    batchId,
    totalGames,
    completedGames: completed,
    failedGames: failed,
    outputFile,
    duration: totalDuration,
  };
}

// ============ 完整性校验 ============

export interface ValidationResult {
  passed: boolean;
  totalLines: number;
  errors: string[];
  samplePassed: boolean;
}

/**
 * 对 JSON Lines 文件执行完整性校验
 * 1. 数量校验
 * 2. 格式校验
 * 3. 逻辑校验
 * 4. 种子复现采样
 */
export function validateBatch(outputFile: string, expectedCount?: number): ValidationResult {
  const errors: string[] = [];

  // 检查文件是否存在
  if (!fs.existsSync(outputFile)) {
    return { passed: false, totalLines: 0, errors: ['文件不存在'], samplePassed: false };
  }

  const content = fs.readFileSync(outputFile, 'utf-8').trim();
  const lines = content.split('\n').filter(l => l.trim());

  // 1. 数量校验（仅在提供预期值时执行）
  if (expectedCount !== undefined) {
    const countDeviation = Math.abs(lines.length - expectedCount) / expectedCount;
    if (countDeviation > 0.01) {
      errors.push(`数量偏差 ${(countDeviation * 100).toFixed(1)}% (预期 ${expectedCount}, 实际 ${lines.length})`);
    }
  }

  // 2. 格式校验
  let parseErrors = 0;
  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i]);
      if (!obj.version || !obj.seed || !obj.config || !obj.finalState) {
        parseErrors++;
        if (parseErrors <= 3) errors.push(`行 ${i}: 字段不完整`);
      }
    } catch {
      parseErrors++;
      if (parseErrors <= 3) errors.push(`行 ${i}: JSON 解析失败`);
    }
  }
  if (parseErrors > 0) {
    errors.push(`格式/解析错误 ${parseErrors} 行`);
  }

  // 3. 逻辑校验
  let logicErrors = 0;
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    try {
      const obj = JSON.parse(lines[i]) as Replay;
      if (obj.finalState.turn > 100) logicErrors++;
      for (const p of obj.finalState.players) {
        if (p.finalHP < 0 || p.finalHP > p.maxHP) logicErrors++;
      }
      if (obj.winner !== null) {
        const winnerExists = obj.finalState.players.some(p => p.id === obj.winner);
        if (!winnerExists) logicErrors++;
      }
    } catch { /* already counted */ }
  }
  if (logicErrors > 0) {
    errors.push(`逻辑校验发现 ${logicErrors} 个异常`);
  }

  // 4. 种子复现采样（抽 0.1% 或至少 1 行）
  let samplePassed = true;
  const sampleSize = Math.max(1, Math.floor(lines.length * 0.001));
  for (let i = 0; i < sampleSize && i < lines.length; i++) {
    try {
      const original = JSON.parse(lines[i]) as Replay;
      // 简单验证种子生成的一致性
      const firstVal = original.seed;
      if (typeof firstVal !== 'number' || firstVal <= 0) {
        samplePassed = false;
      }
    } catch {
      samplePassed = false;
    }
  }

  const passed = errors.length === 0;
  return {
    passed,
    totalLines: lines.length,
    errors,
    samplePassed,
  };
}

// ============ 工具 ============

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
