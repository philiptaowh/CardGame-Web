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

/** 把 'YYYY-MM-DD' 格式补全为 'YYYY-MM-DD 00:00:00' (MySQL DATETIME 格式) */
function toMysqlDateTimeStart(s: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s} 00:00:00` : s;
}
function toMysqlDateTimeEnd(s: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s} 23:59:59` : s;
}

// ============ GET /api/admin/replays ============

adminRouter.get('/admin/replays', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;

  // 修复 mysql2 prepared statement DATETIME 兼容:
  // 字符串 '2026-01-01' 直接传会触发 "Incorrect arguments to mysqld_stmt_execute"
  // 解决: 补全时间部分, 或转 Date 对象
  const sinceRaw = (req.query.since as string) || '1970-01-01';
  const untilRaw = (req.query.until as string) || '2099-12-31';
  const since = toMysqlDateTimeStart(sinceRaw);
  const until = toMysqlDateTimeEnd(untilRaw);
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 10000);
  const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

  try {
    // 1) 查总数 (供客户端判断是否还有下一页)
    // v2.2.1.5 修复：用 query() 替代 execute() — mysql2 prepared statement 对 DATETIME ?
    // 触发 "Incorrect arguments to mysqld_stmt_execute" 是已知 bug，query() 用 text
    // 协议 + 客户端 escape 绕过。byChar/total 不涉及 DATETIME 参数保持 execute()。
    const [countRows] = await getPool().query<any[]>(
      `SELECT COUNT(*) AS c FROM replays
        WHERE created_at >= ? AND created_at < ?`,
      [since, until],
    );
    const total = Number(countRows[0]?.c ?? 0);

    // 2) 查当前页（同理用 query()）
    const [rows] = await getPool().query<any[]>(
      `SELECT id, client_ip, user_agent, char_player, char_ai, winner,
              turn_count, duration_ms, moves_count, payload, created_at
         FROM replays
         WHERE created_at >= ? AND created_at < ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      [since, until, limit, offset],
    );

    // payload 是 JSON 字符串, 保持原样返回 (客户端按需 JSON.parse)
    const data = rows.map((r: any) => ({
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
