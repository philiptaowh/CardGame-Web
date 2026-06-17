// v2.2.0-alpha 后端 - 健康检查路由
//
// GET /api/health
// 响应: { status: 'ok' | 'error', db: 'connected' | 'disconnected', count: number, uptime: number }

import { Router } from 'express';
import { getPool, pingDatabase } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const dbOk = await pingDatabase();
  let count = 0;
  if (dbOk) {
    try {
      const [rows] = await getPool().query<any[]>('SELECT COUNT(*) AS c FROM replays');
      count = Number(rows[0]?.c ?? 0);
    } catch (err) {
      console.error('[health] count failed:', err);
    }
  }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'error',
    db: dbOk ? 'connected' : 'disconnected',
    count,
    uptime: process.uptime(),
    version: '2.2.0-alpha.0',
  });
});
