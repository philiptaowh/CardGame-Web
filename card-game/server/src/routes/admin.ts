// v2.2.1.4 — 录像下载 admin API
//
// GET /api/admin/replays?since=&until=&limit=&offset=
// Headers: X-Admin-Token: <ADMIN_TOKEN from .env>
//
// 用途：开发者从本机拉取服务端录像到 V1Replay JSONL,
//       直接喂 V2 analysis/main.py 进行角色平衡分析。
//
// 鉴权：所有 admin 路由都需 X-Admin-Token header 校验
//       （与 .env 的 ADMIN_TOKEN 完全匹配）
//
// 分页：limit 默认 100，上限 10000；offset 默认 0
// 排序：按 created_at DESC（最新优先）

import { Router, type Request, type Response } from 'express';
import { getPool } from '../db.js';

export const adminRouter = Router();

/** 校验 X-Admin-Token header */
function checkAdminAuth(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(500).json({ ok: false, error: 'ADMIN_TOKEN 未配置 (服务器 .env)' });
    return false;
  }
  const provided = req.headers['x-admin-token'];
  if (typeof provided !== 'string' || provided !== expected) {
    res.status(401).json({ ok: false, error: 'Unauthorized (X-Admin-Token 缺失或错误)' });
    return false;
  }
  return true;
}

// ============ GET /api/admin/replays ============

adminRouter.get('/admin/replays', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;

  const since = (req.query.since as string) || '1970-01-01';
  const until = (req.query.until as string) || '2099-12-31';
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 10000);
  const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

  try {
    // 1) 查总数 (供客户端判断是否还有下一页)
    const [countRows] = await getPool().execute<any[]>(
      `SELECT COUNT(*) AS c FROM replays
        WHERE created_at >= ? AND created_at < ?`,
      [since, until],
    );
    const total = Number(countRows[0]?.c ?? 0);

    // 2) 查当前页
    const [rows] = await getPool().execute<any[]>(
      `SELECT id, client_ip, user_agent, char_player, char_ai, winner,
              turn_count, duration_ms, moves_count, payload, created_at
         FROM replays
         WHERE created_at >= ? AND created_at < ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      [since, until, limit, offset],
    );

    // payload 是 JSON 字符串, 保持原样返回 (客户端按需 JSON.parse)
    const data = rows.map((r) => ({
      id: r.id,
      client_ip: r.client_ip,
      user_agent: r.user_agent,
      char_player: r.char_player,
      char_ai: r.char_ai,
      winner: r.winner,
      turn_count: r.turn_count,
      duration_ms: r.duration_ms,
      moves_count: r.moves_count,
      payload: typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload),
      created_at: r.created_at,
    }));

    res.json({ ok: true, data, total, limit, offset });
  } catch (err) {
    console.error('[admin] GET /admin/replays failed:', err);
    res.status(500).json({
      ok: false,
      error: `查询失败: ${(err as Error)?.message ?? String(err)}`,
    });
  }
});

// ============ GET /api/admin/stats (辅助, 自检) ============

adminRouter.get('/admin/stats', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const [byChar] = await getPool().execute<any[]>(
      `SELECT char_ai, winner, COUNT(*) AS count
         FROM replays
         WHERE char_ai <> '' AND winner <> ''
         GROUP BY char_ai, winner
         ORDER BY char_ai, winner`,
    );

    const [totals] = await getPool().execute<any[]>(
      `SELECT
         COUNT(*) AS total,
         MIN(created_at) AS first_replay,
         MAX(created_at) AS last_replay
       FROM replays`,
    );

    res.json({
      ok: true,
      totals: totals[0],
      by_char_ai_winner: byChar,
    });
  } catch (err) {
    console.error('[admin] GET /admin/stats failed:', err);
    res.status(500).json({
      ok: false,
      error: `查询失败: ${(err as Error)?.message ?? String(err)}`,
    });
  }
});
