// v2.2.1.2 — 共享测试进度路由
//
// 4 个端点：
//   GET  /api/test-progress          → 81 matchup + 状态
//   POST /api/test-progress/increment → +1（已完成则 409）
//   POST /api/test-progress/reset     → 清空 81 行 completed（保留 target）
//   POST /api/test-progress/select-random → 从 available 中随机挑一个
//
// 锁定机制：当 completed >= target 时，前端灰显 + 后端拒绝 increment
// Race 防护：9/10 时两用户同时+1，第二个返回 409 Conflict

import { Router } from 'express';
import type { Request } from 'express';
import type { ResultSetHeader } from 'mysql2';
import { getPool } from '../db.js';

export const testProgressRouter = Router();

// ============ 类型 ============

interface TestProgressRow {
  matchup_key: string;
  human_char: string;
  ai_char: string;
  target: number;
  completed: number;
  completed_at: number[];
  last_player_ip: string;
  last_player_ua: string;
  updated_at: string;
}

/** 客户端可见的 matchup 数据 (剥离 IP/UA 调试字段) */
interface MatchupDTO {
  matchupKey: string;
  humanChar: string;
  aiChar: string;
  target: number;
  completed: number;
  /** 'available' = completed < target; 'locked' = 已收满 */
  status: 'available' | 'locked';
}

const ALL_CHARS = ['char_1', 'char_2', 'char_3', 'char_4', 'char_5', 'char_6', 'char_7', 'char_8', 'char_9'] as const;

function rowToDTO(row: TestProgressRow): MatchupDTO {
  return {
    matchupKey: row.matchup_key,
    humanChar: row.human_char,
    aiChar: row.ai_char,
    target: row.target,
    completed: row.completed,
    status: row.completed >= row.target ? 'locked' : 'available',
  };
}

function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]!.trim().slice(0, 45);
  }
  return (req.socket.remoteAddress ?? '').slice(0, 45);
}

// ============ GET /api/test-progress ============

testProgressRouter.get('/test-progress', async (_req, res) => {
  try {
    const [rows] = await getPool().query<any[]>(
      `SELECT matchup_key, human_char, ai_char, target, completed, completed_at,
              last_player_ip, last_player_ua, updated_at
         FROM test_progress
         ORDER BY human_char, ai_char`,
    );
    const data: MatchupDTO[] = (rows as TestProgressRow[]).map(rowToDTO);

    // 统计
    const totalTarget = data.reduce((sum, m) => sum + m.target, 0);
    const totalCompleted = data.reduce((sum, m) => sum + m.completed, 0);
    const lockedCount = data.filter(m => m.status === 'locked').length;

    res.json({
      ok: true,
      data,
      stats: {
        total: data.length,
        locked: lockedCount,
        available: data.length - lockedCount,
        completed: totalCompleted,
        target: totalTarget,
        remaining: totalTarget - totalCompleted,
      },
      config: {
        defaultTarget: 10,
        version: 1,
      },
    });
  } catch (err) {
    console.error('[test-progress] GET failed:', err);
    res.status(500).json({ ok: false, error: `查询失败: ${(err as Error)?.message ?? String(err)}` });
  }
});

// ============ POST /api/test-progress/increment ============

testProgressRouter.post('/test-progress/increment', async (req, res) => {
  const body = req.body as { humanChar?: string; aiChar?: string };
  if (!body.humanChar || !body.aiChar) {
    res.status(400).json({ ok: false, error: '缺少 humanChar 或 aiChar' });
    return;
  }
  if (!ALL_CHARS.includes(body.humanChar as any) || !ALL_CHARS.includes(body.aiChar as any)) {
    res.status(400).json({ ok: false, error: 'humanChar/aiChar 必须是 char_1 ~ char_9' });
    return;
  }
  const matchupKey = `${body.humanChar}|${body.aiChar}`;
  const ip = extractClientIp(req);
  const ua = (req.headers['user-agent'] ?? '').toString().slice(0, 255);

  try {
    // 原子操作: 条件 update + 读 updated row
    // 关键: WHERE completed < target 防止已锁定 matchup 被+1
    const [result] = await getPool().execute<any>(
      `UPDATE test_progress
          SET completed = completed + 1,
              completed_at = JSON_ARRAY_APPEND(IFNULL(completed_at, JSON_ARRAY()), '$', ?),
              last_player_ip = ?,
              last_player_ua = ?
        WHERE matchup_key = ? AND completed < target`,
      [Date.now(), ip, ua, matchupKey],
    );

    if (result.affectedRows === 0) {
      // 检查是否存在（区分 404 vs 409）
      const [rows] = await getPool().query<any[]>(
        `SELECT completed, target FROM test_progress WHERE matchup_key = ?`,
        [matchupKey],
      );
      if (rows.length === 0) {
        res.status(404).json({ ok: false, error: `matchup ${matchupKey} 不存在` });
        return;
      }
      // 已锁定
      res.status(409).json({
        ok: false,
        error: `matchup ${matchupKey} 已锁定 (${rows[0].completed}/${rows[0].target})`,
        code: 'LOCKED',
      });
      return;
    }

    // 读最新状态返回
    const [rows] = await getPool().query<any[]>(
      `SELECT matchup_key, human_char, ai_char, target, completed, completed_at,
              last_player_ip, last_player_ua, updated_at
         FROM test_progress WHERE matchup_key = ?`,
      [matchupKey],
    );
    const dto = rowToDTO(rows[0] as TestProgressRow);
    res.status(200).json({ ok: true, data: dto });
  } catch (err) {
    console.error('[test-progress] increment failed:', err);
    res.status(500).json({ ok: false, error: `increment 失败: ${(err as Error)?.message ?? String(err)}` });
  }
});

// ============ POST /api/test-progress/reset ============

testProgressRouter.post('/test-progress/reset', async (_req, res) => {
  try {
    // 清空 completed / completed_at（保留 target=10）
    const [result] = await getPool().execute<ResultSetHeader>(
      `UPDATE test_progress SET completed = 0, completed_at = JSON_ARRAY(),
                                last_player_ip = '', last_player_ua = ''`,
    );
    res.json({ ok: true, affected: result.affectedRows });
  } catch (err) {
    console.error('[test-progress] reset failed:', err);
    res.status(500).json({ ok: false, error: `reset 失败: ${(err as Error)?.message ?? String(err)}` });
  }
});

// ============ POST /api/test-progress/select-random ============

testProgressRouter.post('/test-progress/select-random', async (_req, res) => {
  try {
    // 从 available (completed < target) 中随机挑一个
    // MySQL 8 支持 ORDER BY RAND() LIMIT 1
    const [rows] = await getPool().query<any[]>(
      `SELECT matchup_key, human_char, ai_char, target, completed, completed_at,
              last_player_ip, last_player_ua, updated_at
         FROM test_progress
         WHERE completed < target
         ORDER BY RAND()
         LIMIT 1`,
    );
    if (rows.length === 0) {
      // 所有 matchup 都已锁定
      res.status(409).json({ ok: false, error: '所有 matchup 已锁定，无可选项', code: 'ALL_LOCKED' });
      return;
    }
    const dto = rowToDTO(rows[0] as TestProgressRow);
    res.json({ ok: true, data: dto });
  } catch (err) {
    console.error('[test-progress] select-random failed:', err);
    res.status(500).json({ ok: false, error: `select-random 失败: ${(err as Error)?.message ?? String(err)}` });
  }
});
