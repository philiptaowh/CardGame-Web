// CLI — 命令行入口 + 文本回放器
// V2 仿真平台组件
//
// 使用方式：
//   node dist-engine/simulator/cli.js run [--games N] [--policies P1,P2,...]
//   node dist-engine/simulator/cli.js replay <jsonl-file> [--index N] [--last]
//   node dist-engine/simulator/cli.js stats <jsonl-file>
//   node dist-engine/simulator/cli.js test
//
// 回放格式严格遵循 卡牌游戏2.0原型.md §3.4

import * as fs from 'fs';
import * as path from 'path';
import type { CharacterId, PlayerId } from '../types';
import { getCharacterById } from '../game/characters';
import { getPresetNames, getPresetParams } from '../ai/interfaces';
import { RuleBasedAI } from '../ai/ruleBasedAI';
import { RandomAI } from '../ai/randomAI';
import { runGame, generateMatchups, createOptimizedPolicy } from './gameRunner';
import { runBatch, runBatchWorkers } from './concurrentRunner';
import type { Replay, Move } from '../types/replay';
import type { Action } from '../ai/interfaces';
import { ALL_CHARACTERS } from './gameRunner';
import { runAnalysis } from '../analysis/cli';

// ============ 主入口 ============

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'run':
      runSimulation(args.slice(1));
      break;
    case 'replay':
      replayGame(args.slice(1));
      break;
    case 'stats':
      computeStats(args.slice(1));
      break;
    case 'analyze':
      runAnalysisFromCLI(args.slice(1));
      break;
    case 'test':
      runSelfTest();
      break;
    default:
      printUsage();
  }
}

function printUsage(): void {
  console.log(`
卡牌游戏 仿真平台 CLI (v2.1.0)

使用方式:
  node dist-engine/simulator/cli.js run [选项]
  node dist-engine/simulator/cli.js replay <jsonl-file> [--index N] [--last]
  node dist-engine/simulator/cli.js stats <jsonl-file>
  node dist-engine/simulator/cli.js analyze <jsonl-file> [--gpu] [选项]
  node dist-engine/simulator/cli.js test

选项 (run):
  --games N          每个组合运行 N 局 (默认: 10)
  --policies P1,P2   策略列表 (默认: 全部 10 个预设 + RandomAI)
  --optimized        使用 BO 优化后的角色最优参数（覆盖 --policies）
  --workers N        Worker 线程数 (默认: CPU 核心数 / 2)
  --seed N           实验种子 (默认: 当前时间戳)
  --output DIR       输出目录 (默认: ./data/raw)

回放选项:
  --index N          回放第 N 场对局 (从 0 开始)
  --last             回放最后一场

分析选项 (analyze):
  --gpu              启用 GPU 加速 (需要 pytorch_gpu 环境)
  --output DIR       输出 HTML 报告路径
  --max-games N      最大加载对局数 (调试用)
  --no-report        不生成 HTML 报告，仅输出统计数据
  `);
}

// ============ 运行仿真 ============

async function runSimulation(args: string[]): Promise<void> {
  const opts = parseArgs(args);
  const gamesPerMatchup = parseInt(getArg(opts, '--games', '10'), 10);
  const workers = parseInt(getArg(opts, '--workers', '0'), 10);
  const seed = parseInt(getArg(opts, '--seed', String(new Date().getTime())), 10);
  const outputDir = getArg(opts, '--output', './data/raw');

  // 修复 --policies 解析：区分"未指定"和"指定为空"
  const policySpecified = opts['--policies'] !== undefined;
  const policyRaw = opts['--policies'];
  const policyNames = (policySpecified && policyRaw !== 'true')
    ? policyRaw.split(',').map(s => s.trim()).filter(Boolean)
    : getPresetNames();
  const useOptimized = opts['--optimized'] === 'true' || opts['--optimized'] === '';

  console.log(`仿真配置:`);
  console.log(`  对局数/组合: ${gamesPerMatchup}`);
  console.log(`  策略: ${useOptimized ? '角色最优参数' : policyNames.join(', ') + (!policySpecified ? ' + RandomAI' : '')}`);
  console.log(`  Worker 线程: ${workers > 0 ? workers : '主线程(单核)'}`);
  console.log(`  种子: ${seed}`);
  console.log(`  输出: ${outputDir}`);
  console.log('');

  let result;
  if (useOptimized) {
    // 最优参数模式：每个角色用自己的 BO 最优 θ 对战
    const matchups = generateMatchups();
    const tasks = [];
    for (const [charA, charB] of matchups) {
      for (let g = 0; g < gamesPerMatchup; g++) {
        tasks.push({ charA, charB, matchIndex: tasks.length });
      }
    }
    const totalGames = tasks.length;
    console.log(`[优化模式] 角色组合: ${matchups.length}, 每组合局数: ${gamesPerMatchup}, 总对局: ${totalGames}`);
    console.log('');

    const { runBatch } = await import('./concurrentRunner');
    const { deriveSeed } = await import('../types/replay');
    const fs = await import('fs');
    const path = await import('path');
    const outputFile = path.join(outputDir, `${new Date().toISOString().slice(0, 10)}_optimal-batch.jsonl`);
    fs.mkdirSync(outputDir, { recursive: true });
    const writeStream = fs.createWriteStream(outputFile, { flags: 'a' });
    let completed = 0, failed = 0;
    const startTime = Date.now();
    const concurrency = 8;

    const worker = async (task: typeof tasks[0]) => {
      try {
        const replay = runGame({
          charId1: task.charA,
          charId2: task.charB,
          policy1: createOptimizedPolicy(task.charA),
          policy2: createOptimizedPolicy(task.charB),
          experimentSeed: seed,
          matchIndex: task.matchIndex,
          recordMoves: false,
        });
        writeStream.write(JSON.stringify(replay) + '\n');
      } catch (err) {
        failed++;
        console.error(`[失败] ${task.charA} vs ${task.charB}: ${err}`);
      }
    };

    const queue = [...tasks];
    const running: Promise<void>[] = [];
    while (queue.length > 0 || running.length > 0) {
      while (running.length < concurrency && queue.length > 0) {
        const task = queue.shift()!;
        const p = worker(task).then(() => { completed++; });
        running.push(p);
      }
      if (running.length > 0) {
        await Promise.race(running);
        while (running.length > 0) {
          const idx = await Promise.race(running.map((p, i) => p.then(() => i).catch(() => i)));
          running.splice(idx, 1);
        }
      }
    }
    writeStream.end();
    const totalDuration = Date.now() - startTime;
    result = {
      outputFile,
      completedGames: completed,
      failedGames: failed,
      duration: totalDuration,
    };
    console.log(`\n优化模式批量完成:`);
    console.log(`  输出文件: ${result.outputFile}`);
    console.log(`  成功: ${result.completedGames}`);
    console.log(`  失败: ${result.failedGames}`);
    console.log(`  耗时: ${(result.duration / 1000).toFixed(1)}s`);
    return;
  }

  if (workers > 0) {
    result = await runBatchWorkers({
      experimentSeed: seed,
      gamesPerMatchup,
      policyNames,
      includeRandomBaseline: !policySpecified,
      workerCount: workers,
      outputDir,
    });
  } else {
    result = await runBatch({
      experimentSeed: seed,
      gamesPerMatchup,
      policyNames,
      includeRandomBaseline: !policySpecified,
      concurrency: 8,
      outputDir,
    });
  }

  console.log(`\n批量完成:`);
  console.log(`  输出文件: ${result.outputFile}`);
  console.log(`  成功: ${result.completedGames}`);
  console.log(`  失败: ${result.failedGames}`);
  console.log(`  耗时: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`  吞吐: ${(result.completedGames / (result.duration / 1000)).toFixed(0)} 局/秒`);
}

// ============ 文本回放器 ============

function replayGame(args: string[]): void {
  const opts = parseArgs(args);
  const positional = args.filter(a => !a.startsWith('--'));
  const filePath = positional[0];

  if (!filePath) {
    console.error('错误: 请指定 JSON Lines 文件路径');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`错误: 文件不存在: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = content.split('\n').filter(l => l.trim());

  let targetIndex: number;
  if (opts['--last']) {
    targetIndex = lines.length - 1;
  } else if (opts['--index']) {
    targetIndex = parseInt(opts['--index'], 10);
  } else {
    targetIndex = 0;
  }

  if (targetIndex < 0 || targetIndex >= lines.length) {
    console.error(`错误: 索引 ${targetIndex} 超出范围 (共 ${lines.length} 场对局)`);
    process.exit(1);
  }

  let replay: Replay;
  try {
    replay = JSON.parse(lines[targetIndex]) as Replay;
  } catch {
    console.error(`错误: 第 ${targetIndex} 行 JSON 解析失败`);
    process.exit(1);
  }

  renderReplay(replay, targetIndex);
}

// ==================== 回放渲染 ====================

function renderReplay(replay: Replay, gameIndex: number): void {
  const { config, seed, winner, finalState } = replay;

  const charNames: Record<string, string> = {};
  for (const p of config.policies) {
    const char = getCharacterById(p.characterId);
    charNames[p.characterId] = char?.name ?? p.characterId;
  }

  const policyNames = config.policies.map(p => `(${p.policyName})`);

  // ===== 标题 =====
  const p1Char = config.policies[0];
  const p2Char = config.policies[1];
  const winnerName = winner
    ? finalState.players.find(p => p.id === winner)?.characterId ?? 'unknown'
    : '平局';

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  对局 #${gameIndex} | ${charNames[p1Char.characterId]} vs ${charNames[p2Char.characterId]}`);
  console.log(`  种子: ${seed} | ${finalState.turn} 回合 | ${winner ? charNames[winnerName] || '未知' : '平局'} 胜`);
  console.log('══════════════════════════════════════════════════════');
  console.log('');

  // 追踪各玩家的 HP/护盾/印记
  const playerStates = new Map<PlayerId, {
    hp: number; maxHp: number; shield: number; marks: Array<{ name: string; turns: number }>;
  }>();

  // 使用完整的 moves 重建状态
  let currentTurn = 0;
  let currentPhase = '';

  for (const move of replay.moves) {
    // 回合标题
    if (move.turn !== currentTurn) {
      if (currentTurn > 0) {
        console.log(`  回合 ${currentTurn} 结束`);
        console.log('');
      }
      currentTurn = move.turn;
      console.log(`  ── 回合 ${currentTurn} ──────────────────────────────────────`);
      currentPhase = '';
    }

    // 阶段标题（仅在变化时输出）
    if (move.phase !== currentPhase) {
      currentPhase = move.phase;
      if (move.phase === 'card_exchange') {
        console.log('  换牌阶段:');
      } else if (move.phase === 'phase1') {
        console.log('');
        console.log('  阶段1 - 能量放置:');
      } else if (move.phase === 'phase2') {
        console.log('');
        console.log('  阶段2 - 行动:');
        console.log('  ─────────────────────────────────────────');
      }
    }

    // 渲染动作
    renderMove(move, replay, playerStates);
  }

  // 最终结果
  console.log('');
  console.log('  ── 游戏结束 ──────────────────────────────────────');
  for (const p of finalState.players) {
    const char = getCharacterById(p.characterId);
    console.log(`  ${char?.name ?? p.characterId}: HP ${p.finalHP}/${p.maxHP} 护盾 ${p.finalShield}`);
  }
  if (winner) {
    console.log(`  🏆 胜者: ${charNames[finalState.players.find(p => p.id === winner)?.characterId ?? ''] ?? winner}`);
  } else {
    console.log('  🤝 平局');
  }
  console.log('');
}

function renderMove(
  move: Move,
  replay: Replay,
  playerStates: Map<PlayerId, { hp: number; maxHp: number; shield: number; marks: Array<{ name: string; turns: number }> }>,
): void {
  const { action, playerId, phase } = move;
  const pConfig = replay.config.policies.find(p => p.playerId === playerId);
  if (!pConfig) return;

  const char = getCharacterById(pConfig.characterId);
  const playerName = char?.name ?? pConfig.characterId;

  // 初始化或更新玩家状态追踪
  if (!playerStates.has(playerId)) {
    const fp = replay.finalState.players.find(p => p.id === playerId);
    playerStates.set(playerId, {
      hp: fp?.maxHP ?? 100,
      maxHp: fp?.maxHP ?? 100,
      shield: 0,
      marks: [],
    });
  }

  switch (action.type) {
    case 'exchange':
      console.log(`    ${playerName}: 替换 ${action.cardIndex + 1} 张卡`);
      break;

    case 'place_energy': {
      const pState = playerStates.get(playerId)!;
      console.log(`    ${playerName} → 放置 [能量]`);
      break;
    }

    case 'use_skill': {
      const skill = char?.skills[action.skillIndex];
      if (!skill) break;
      const targetConfig = replay.config.policies.find(p => p.playerId === action.targetId);
      const targetName = targetConfig
        ? (getCharacterById(targetConfig.characterId)?.name ?? targetConfig.characterId)
        : action.targetId;

      console.log('');
      console.log(`    [${playerName}] 行动:`);

      // 玩家状态行
      renderStatusLine(playerId, replay, playerStates, playerName);

      // 目标状态行
      if (action.targetId !== playerId) {
        renderStatusLine(action.targetId, replay, playerStates, targetName);
      }

      // 技能使用
      const paymentCards = action.paymentCardIndices.map(idx => {
        const state = replay.finalState; // 无法获取手牌，使用描述
        return `${idx}e`;
      }).join(', ');
      console.log(`      消耗 [能量] 使用 [${skill.name} ${skill.description}] → ${targetName}`);

      // 效果行（简化：直接从描述推断）
      // 实际回放应追踪引擎的 hp 变化，但这里仅基于 replay stats 简化输出
      break;
    }

    case 'use_special_card': {
      const cardEffectId = findSpecialEffectId(replay, playerId, action.cardIndex);
      console.log(`      使用 [特殊卡${cardEffectId}] → ${action.targetId ? '目标' : '自身'}`);
      break;
    }

    case 'pass':
      if (phase === 'phase1') {
        // 换牌阶段 pass 不输出
      } else if (phase === 'card_exchange') {
        console.log(`    ${playerName}: 替换 0 张卡`);
      } else if (phase === 'phase2') {
        console.log('');
        console.log(`    [${playerName}] 行动:`);
        renderStatusLine(playerId, replay, playerStates, playerName);
        console.log(`      结束行动`);
      }
      break;
  }
}

function renderStatusLine(
  playerId: PlayerId,
  replay: Replay,
  playerStates: Map<PlayerId, { hp: number; maxHp: number; shield: number; marks: Array<{ name: string; turns: number }> }>,
  displayName: string,
): void {
  const state = playerStates.get(playerId);
  if (!state) return;

  const marksStr = state.marks.length > 0
    ? state.marks.map(m => `${m.name}(${m.turns})`).join(', ')
    : '无';
  console.log(`    [${displayName}] HP:${state.hp}/${state.maxHp}  护盾:${state.shield}  印记:${marksStr}`);
}

function findSpecialEffectId(replay: Replay, playerId: PlayerId, cardIndex: number): number {
  // 从 replay 中尽量推断，简化处理
  return cardIndex + 1;
}

// ============ 自测 ============

function runSelfTest(): void {
  console.log('运行自测: 2 场对局...\n');

  const policy1 = new RuleBasedAI('balanced', getPresetParams('balanced')!);
  const policy2 = new RuleBasedAI('aggressive', getPresetParams('aggressive')!);

  const replay1 = runGame({
    charId1: 'char_1',
    charId2: 'char_3',
    policy1,
    policy2,
    experimentSeed: 20260601,
    matchIndex: 0,
    recordMoves: true,
  });

  console.log(`对局 1: char_1 vs char_3`);
  console.log(`  胜者: ${replay1.winner} | 回合: ${replay1.finalState.turn} | 种子: ${replay1.seed}`);
  console.log(`  动作数: ${replay1.moves.length} | 耗时: ${replay1.duration}ms`);
  console.log('');

  const replay2 = runGame({
    charId1: 'char_7',
    charId2: 'char_2',
    policy1: new RuleBasedAI('controller', getPresetParams('controller')!),
    policy2: new RuleBasedAI('survivalist', getPresetParams('survivalist')!),
    experimentSeed: 20260602,
    matchIndex: 1,
    recordMoves: true,
  });

  console.log(`对局 2: char_7 vs char_2`);
  console.log(`  胜者: ${replay2.winner} | 回合: ${replay2.finalState.turn} | 种子: ${replay2.seed}`);
  console.log(`  动作数: ${replay2.moves.length} | 耗时: ${replay2.duration}ms`);
  console.log('');

  // 可复现性测试
  console.log('可复现性测试: 使用相同种子运行 2 次...');
  const r1 = runGame({
    charId1: 'char_5', charId2: 'char_6',
    policy1: new RuleBasedAI('greedy', getPresetParams('greedy')!),
    policy2: new RuleBasedAI('balanced', getPresetParams('balanced')!),
    experimentSeed: 9999, matchIndex: 42,
    recordMoves: true,
  });
  const r2 = runGame({
    charId1: 'char_5', charId2: 'char_6',
    policy1: new RuleBasedAI('greedy', getPresetParams('greedy')!),
    policy2: new RuleBasedAI('balanced', getPresetParams('balanced')!),
    experimentSeed: 9999, matchIndex: 42,
    recordMoves: true,
  });

  const consistent = r1.winner === r2.winner
    && r1.finalState.turn === r2.finalState.turn
    && r1.moves.length === r2.moves.length
    && JSON.stringify(r1.finalState) === JSON.stringify(r2.finalState);

  console.log(`  结果一致: ${consistent ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  胜者: ${r1.winner} vs ${r2.winner}`);
  console.log(`  回合: ${r1.finalState.turn} vs ${r2.finalState.turn}`);
  console.log(`  动作数: ${r1.moves.length} vs ${r2.moves.length}`);
  console.log('');

  console.log('全部自测完成!');

  // ---- 最优参数测试 ----
  console.log('');
  console.log('最优参数测试:');
  const optPolicy6 = createOptimizedPolicy('char_6');
  const optPolicy3 = createOptimizedPolicy('char_3', 'optimal-char_3');
  console.log(`  char_6 (${optPolicy6.params.aggro.toFixed(3)}, hp_danger=${optPolicy6.params.hp_danger.toFixed(3)})`);
  console.log(`  char_3 (${optPolicy3.params.aggro.toFixed(3)}, hp_danger=${optPolicy3.params.hp_danger.toFixed(3)})`);

  const optReplay = runGame({
    charId1: 'char_6',
    charId2: 'char_3',
    policy1: optPolicy6,
    policy2: optPolicy3,
    experimentSeed: 20260610,
    matchIndex: 0,
    recordMoves: true,
  });
  console.log(`  对局: char_6 vs char_3 (均用最优参数)`);
  console.log(`  胜者: ${optReplay.winner} | 回合: ${optReplay.finalState.turn}`);
}

// ============ 分析命令 ============

async function runAnalysisFromCLI(args: string[]): Promise<void> {
  const opts = parseArgs(args);
  const positional = args.filter(a => !a.startsWith('--'));
  const jsonlFile = positional[0];

  if (!jsonlFile) {
    console.error('错误: 请指定 JSON Lines 数据文件路径');
    console.log('  node dist-engine/simulator/cli.js analyze <jsonl-file> [--gpu]');
    process.exit(1);
  }

  // 解析参数
  const useGpu = opts['--gpu'] === 'true' || opts['--gpu'] === '';
  const maxGames = opts['--max-games'] ? parseInt(opts['--max-games'], 10) : undefined;
  const outputPath = opts['--output'] !== undefined && opts['--output'] !== 'true'
    ? opts['--output'] : undefined;
  const noReport = opts['--no-report'] === 'true';

  console.log(`分析配置:`);
  console.log(`  数据文件: ${jsonlFile}`);
  console.log(`  GPU: ${useGpu ? '启用' : '禁用'}`);
  console.log(`  最大对局: ${maxGames ?? '全部'}`);
  console.log(`  报告输出: ${noReport ? '不生成' : outputPath ?? '自动'}`);
  console.log('');

  const result = await runAnalysis({
    jsonlFile,
    gpu: useGpu,
    output: outputPath,
    maxGames,
    noReport,
  });

  console.log(`\n分析完成:`);
  console.log(`  Python 环境: ${result.pythonEnv}`);
  console.log(`  处理对局: ${result.totalGames}`);
  console.log(`  总耗时: ${result.duration.toFixed(1)}s`);
  if (result.reportPath) {
    console.log(`  HTML 报告: ${result.reportPath}`);
  }
  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

// ============ 统计命令 ============

function computeStats(args: string[]): void {
  const positional = args.filter(a => !a.startsWith('--'));
  const filePath = positional[0];

  if (!filePath) {
    console.error('错误: 请指定 JSON Lines 文件路径');
    console.log('  node dist-engine/simulator/cli.js stats <jsonl-file>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`错误: 文件不存在: ${filePath}`);
    process.exit(1);
  }

  console.log(`分析文件: ${filePath}`);
  console.log('');

  const content = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = content.split('\n').filter(l => l.trim());
  const totalGames = lines.length;

  if (totalGames === 0) {
    console.log('文件中没有对局记录');
    return;
  }

  // 解析所有 Replay
  type StatsRecord = {
    charA: string; charB: string;
    policyA: string; policyB: string;
    winner: string | null;
    turns: number;
    duration: number;
    p1Id: string; p2Id: string;
  };

  const records: StatsRecord[] = [];
  let parseErrors = 0;

  for (const line of lines) {
    try {
      const r = JSON.parse(line) as Replay;
      const p1 = r.config.policies[0];
      const p2 = r.config.policies[1];
      records.push({
        charA: p1.characterId, charB: p2.characterId,
        policyA: p1.policyName, policyB: p2.policyName,
        winner: r.winner,
        turns: r.finalState.turn,
        duration: r.duration,
        p1Id: p1.playerId, p2Id: p2.playerId,
      });
    } catch { parseErrors++; }
  }

  if (parseErrors > 0) {
    console.log(`⚠  解析失败: ${parseErrors} 行`);
  }

  // ---- 角色胜率矩阵 ----
  const charWins: Record<string, Record<string, { wins: number; total: number }>> = {};
  const charTotalWins: Record<string, { wins: number; total: number }> = {};

  for (const rec of records) {
    // 跟踪角色对战胜负
    if (!charWins[rec.charA]) charWins[rec.charA] = {};
    if (!charWins[rec.charA][rec.charB]) charWins[rec.charA][rec.charB] = { wins: 0, total: 0 };
    if (!charWins[rec.charB]) charWins[rec.charB] = {};
    if (!charWins[rec.charB][rec.charA]) charWins[rec.charB][rec.charA] = { wins: 0, total: 0 };

    if (!charTotalWins[rec.charA]) charTotalWins[rec.charA] = { wins: 0, total: 0 };
    if (!charTotalWins[rec.charB]) charTotalWins[rec.charB] = { wins: 0, total: 0 };

    charWins[rec.charA][rec.charB].total++;
    charWins[rec.charB][rec.charA].total++;
    charTotalWins[rec.charA].total++;
    charTotalWins[rec.charB].total++;

    if (rec.winner === rec.p1Id) {
      charWins[rec.charA][rec.charB].wins++;
      charTotalWins[rec.charA].wins++;
    } else if (rec.winner === rec.p2Id) {
      charWins[rec.charB][rec.charA].wins++;
      charTotalWins[rec.charB].wins++;
    }
    // else: 平局，双方都不计胜
  }

  // ---- 策略胜率 ----
  const stratStats: Record<string, { wins: number; total: number }> = {};
  for (const rec of records) {
    if (!stratStats[rec.policyA]) stratStats[rec.policyA] = { wins: 0, total: 0 };
    if (!stratStats[rec.policyB]) stratStats[rec.policyB] = { wins: 0, total: 0 };
    stratStats[rec.policyA].total++;
    stratStats[rec.policyB].total++;
    if (rec.winner === rec.p1Id) stratStats[rec.policyA].wins++;
    else if (rec.winner === rec.p2Id) stratStats[rec.policyB].wins++;
  }

  // ---- 回合/耗时统计 ----
  const turns = records.map(r => r.turns);
  const durations = records.map(r => r.duration);
  turns.sort((a, b) => a - b);
  durations.sort((a, b) => a - b);

  const avgTurns = (turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1);
  const medianTurns = turns[Math.floor(turns.length / 2)];
  const maxTurns = turns[turns.length - 1];
  const avgDur = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0);
  const p95Dur = durations[Math.floor(durations.length * 0.95)];

  // ---- 输出 ----

  // 角色名映射
  const charName = (id: string): string => {
    const c = getCharacterById(id);
    return c ? c.name : id;
  };

  console.log('══════════════════════════════════════════════════════');
  console.log('  对局统计报告');
  console.log(`  总对局: ${totalGames}`);
  console.log(`  解析成功: ${records.length}`);
  console.log('══════════════════════════════════════════════════════');
  console.log('');
  console.log(`  平均回合: ${avgTurns}  |  中位回合: ${medianTurns}  |  最长回合: ${maxTurns}`);
  console.log(`  平均耗时: ${avgDur}ms  |  P95 耗时: ${p95Dur}ms`);
  console.log('');

  // 胜率矩阵
  const allChars = Object.keys(charTotalWins).sort();
  const headerRow = '  '.padEnd(14) + allChars.map(c => charName(c).substring(0, 6).padEnd(8)).join('');
  console.log('  ── 角色胜率矩阵 (行角色 vs 列角色) ──');
  console.log(headerRow);
  for (const rowChar of allChars) {
    const rowName = charName(rowChar).substring(0, 6).padEnd(12);
    let rowStr = `  ${rowName}`;
    for (const colChar of allChars) {
      if (rowChar === colChar) {
        rowStr += '  --    ';
      } else {
        const s = charWins[rowChar]?.[colChar];
        if (s && s.total > 0) {
          const rate = (s.wins / s.total * 100).toFixed(1);
          rowStr += `${rate}%`.padStart(8);
        } else {
          rowStr += '  -     ';
        }
      }
    }
    console.log(rowStr);
  }
  console.log('');

  // 总体胜率排名
  const sortedByWinRate = allChars
    .map(c => ({ char: c, name: charName(c), rate: charTotalWins[c].total > 0 ? charTotalWins[c].wins / charTotalWins[c].total * 100 : 0, total: charTotalWins[c].total }))
    .sort((a, b) => b.rate - a.rate);

  console.log('  ── 角色总体胜率排名 ──');
  console.log(`  ${'排名'.padEnd(4)} ${'角色'.padEnd(12)} ${'胜率'.padEnd(8)} ${'对局数'}`);
  sortedByWinRate.forEach((item, i) => {
    console.log(`  ${(i + 1).toString().padEnd(4)} ${item.name.padEnd(12)} ${item.rate.toFixed(1)}%${' '.padEnd(4)} ${item.total}`);
  });
  console.log('');

  // 策略胜率排名
  const sortedStrat = Object.entries(stratStats)
    .map(([name, s]) => ({ name, rate: s.total > 0 ? s.wins / s.total * 100 : 0, total: s.total }))
    .sort((a, b) => b.rate - a.rate);

  console.log('  ── 策略胜率排名 ──');
  console.log(`  ${'排名'.padEnd(4)} ${'策略'.padEnd(16)} ${'胜率'.padEnd(8)} ${'胜/总'.padEnd(12)} ${'对局数'}`);
  sortedStrat.forEach((item, i) => {
    const s = stratStats[item.name];
    console.log(`  ${(i + 1).toString().padEnd(4)} ${item.name.padEnd(16)} ${item.rate.toFixed(1)}%${' '.padEnd(4)} ${s.wins}/${s.total}${' '.padEnd(4)} ${s.total}`);
  });
  console.log('');
}

function parseArgs(args: string[]): Record<string, string> {
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i];
      if (i + 1 < args.length && !args[i + 1].startsWith('--') && args[i + 1] !== '') {
        opts[key] = args[++i];
      } else {
        opts[key] = 'true';
      }
    }
  }
  return opts;
}

function getArg(opts: Record<string, string>, key: string, defaultValue: string): string {
  return opts[key] !== undefined && opts[key] !== 'true' ? opts[key] : defaultValue;
}

// ============ 启动 ============

main();
