// Worker 线程 — 并行执行对局仿真
// 由 ConcurrentRunner 通过 worker_threads 启动
//
// 每个 Worker 独立运行，不共享任何可变状态
// 接收序列化的任务描述（策略名+参数），在本地构造策略实例后运行对局

import { parentPort } from 'worker_threads';
import type { CharacterId } from '../types';
import type { IPlayerPolicy } from '../ai/interfaces';
import { getPresetParams } from '../ai/interfaces';
import { RuleBasedAI } from '../ai/ruleBasedAI';
import { RandomAI } from '../ai/randomAI';
import { runGame } from './gameRunner';

if (!parentPort) {
  throw new Error('Worker 必须在 worker_threads 上下文中运行');
}

/** 序列化任务描述（可从主线程通过 postMessage 传入） */
interface WorkerTask {
  charId1: CharacterId;
  charId2: CharacterId;
  policy1Name: string;
  policy2Name: string;
  experimentSeed: number;
  matchIndex: number;
  recordMoves: boolean;
}

/** 从策略名构造策略实例（RuleBasedAI 使用预设参数） */
function createPolicy(name: string): IPlayerPolicy {
  if (name === 'RandomAI') {
    return new RandomAI(name);
  }
  const params = getPresetParams(name);
  if (!params) {
    // 回退：用 balanced 作为兜底
    console.error(`[Worker] 未知策略 "${name}"，使用 balanced 替代`);
    return new RuleBasedAI('fallback', getPresetParams('balanced')!);
  }
  return new RuleBasedAI(name, params);
}

/** 接收一批任务，顺序执行后返回结果数组 */
parentPort.on('message', (tasks: WorkerTask[]) => {
  if (!Array.isArray(tasks)) {
    parentPort!.postMessage({ type: 'error', message: '无效任务格式' });
    return;
  }

  const results: string[] = [];

  for (let i = 0; i < tasks.length; i++) {
    try {
      const t = tasks[i];
      const policy1 = createPolicy(t.policy1Name);
      const policy2 = createPolicy(t.policy2Name);

      const replay = runGame({
        charId1: t.charId1,
        charId2: t.charId2,
        policy1,
        policy2,
        experimentSeed: t.experimentSeed,
        matchIndex: t.matchIndex,
        recordMoves: t.recordMoves,
      });

      results.push(JSON.stringify(replay));
    } catch (err) {
      // 单局失败不中断整个 Worker
      results.push(JSON.stringify({
        version: '2.0.0',
        timestamp: Date.now(),
        duration: 0,
        seed: 0,
        config: { policies: [] },
        moves: [],
        winner: null,
        finalState: { turn: 0, players: [] },
        stats: { totalMoves: 0, skillUsage: {}, cardsDrawn: 0, totalTurns: 0 },
        _error: String(err),
      }));
    }
  }

  parentPort!.postMessage({ type: 'results', data: results });
  // 任务完成，退出 Worker 线程
  process.exit(0);
});
