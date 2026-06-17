// v2.2.0-alpha 后端 - 录像上传与统计路由
//
// POST /api/replays
//   body: V1Replay JSON 对象（与 V1 客户端 replayStore 序列化格式一致）
//   行为：提取摘要字段 + 存完整 payload；返回 { ok: true, id: <insertId> }
//   失败：400 参数错误 / 500 服务端错误，body = { ok: false, error: '...' }
//
// GET /api/replays/stats
//   自检用：按 char_ai × winner 聚合的胜率
//   响应: [{ char_ai: 'char_3', winner: 'player', count: 12 }, ...]

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPool } from '../db.js';

export const replaysRouter = Router();

// ============ V1Replay 顶层结构（只校验必要字段） ============

interface V1Move {
  turn: number;
  phase: string;
  playerId: string;
  action: unknown;
  isHuman: boolean;
}

interface V1FinalPlayer {
  id: string;
  characterId: string;
  finalHP: number;
  maxHP: number;
  finalShield: number;
  marks: Array<{ name: string; remaining_turns: number }>;
}

interface V1Replay {
  version: string;
  timestamp: number;
  duration: number;
  seed: number;
  gameMode: '1v1';
  config: {
    humanCharId: string;
    aiCharId: string;
    policies: Array<{
      playerId: string;
      characterId: string;
      policyName: string;
      policyParams: unknown | null;
    }>;
  };
  moves: V1Move[];
  winner: string | null;
  finalState: {
    turn: number;
    players: V1FinalPlayer[];
  };
}

/** 提取胜者字符串（player/ai/draw） */
function deriveWinner(replay: V1Replay): 'player' | 'ai' | 'draw' {
  if (replay.winner === null) return 'draw';
  // 找到 winner 对应的 player 在 policies 中的位置
  const winningPolicy = replay.config.policies.find(p => p.playerId === replay.winner);
  if (!winningPolicy) return 'draw';
  if (winningPolicy.policyName === 'human') return 'player';
  return 'ai';
}

/** 校验 V1Replay 必需字段，返回错误信息（成功返回 null） */
function validateReplay(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'body 必须是对象';
  const r = body as Partial<V1Replay>;
  if (typeof r.version !== 'string') return '缺少 version';
  if (typeof r.timestamp !== 'number') return '缺少 timestamp';
  if (typeof r.gameMode !== 'string') return '缺少 gameMode';
  if (!r.config || typeof r.config !== 'object') return '缺少 config';
  if (typeof r.config.humanCharId !== 'string') return '缺少 config.humanCharId';
  if (typeof r.config.aiCharId !== 'string') return '缺少 config.aiCharId';
  if (!Array.isArray(r.moves)) return '缺少 moves[]';
  if (!r.finalState || typeof r.finalState !== 'object') return '缺少 finalState';
  if (!Array.isArray(r.finalState.players)) return '缺少 finalState.players[]';
  return null;
}

// ============ POST /api/replays ============

replaysRouter.post('/replays', async (req: Request, res: Response) => {
  const validationError = validateReplay(req.body);
  if (validationError) {
    res.status(400).json({ ok: false, error: validationError });
    return;
  }

  const replay = req.body as V1Replay;
  const winner = deriveWinner(replay);

  const summary = {
    client_ip: extractClientIp(req),
    user_agent: (req.headers['user-agent'] ?? '').toString().slice(0, 255),
    char_player: replay.config.humanCharId,
    char_ai: replay.config.aiCharId,
    winner,
    turn_count: replay.finalState.turn,
    duration_ms: replay.duration,
    moves_count: replay.moves.length,
  };

  try {
    const [result] = await getPool().execute<any>(
      `INSERT INTO replays
        (client_ip, user_agent, char_player, char_ai, winner, turn_count, duration_ms, moves_count, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
      [
        summary.client_ip,
        summary.user_agent,
        summary.char_player,
        summary.char_ai,
        summary.winner,
        summary.turn_count,
        summary.duration_ms,
        summary.moves_count,
        JSON.stringify(replay),
      ],
    );
    const insertId = result.insertId;
    res.status(201).json({ ok: true, id: insertId });
  } catch (err) {
    console.error('[replays] INSERT failed:', err);
    res.status(500).json({
      ok: false,
      error: `数据库写入失败: ${(err as Error)?.message ?? String(err)}`,
    });
  }
});

// ============ GET /api/replays/stats ============

replaysRouter.get('/replays/stats', async (_req, res) => {
  try {
    const [rows] = await getPool().query<any[]>(
      `SELECT char_ai, winner, COUNT(*) AS count
       FROM replays
       WHERE char_ai <> '' AND winner <> ''
       GROUP BY char_ai, winner
       ORDER BY char_ai, winner`,
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[replays] stats failed:', err);
    res.status(500).json({
      ok: false,
      error: `查询失败: ${(err as Error)?.message ?? String(err)}`,
    });
  }
});

// ============ 工具函数 ============

/** 提取真实客户端 IP（处理 X-Forwarded-For / X-Real-IP 代理头） */
function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]!.trim().slice(0, 45);
  }
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && xri.length > 0) {
    return xri.trim().slice(0, 45);
  }
  return (req.socket.remoteAddress ?? '').slice(0, 45);
}
