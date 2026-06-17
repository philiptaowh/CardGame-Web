// v2.2.0-alpha 后端 - Express 入口
//
// 启动流程：
//   1. 加载 .env
//   2. 启动时跑 initializeDatabase()（确保 DB 存在 + 建表 + 种子）
//   3. 启动 Express，配置 cors / json 中间件
//   4. 挂载 /api/health, /api/replays, /api/test-progress/*
//   5. 监听 PORT（默认 3000）
//   6. SIGINT/SIGTERM 优雅退出

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { initializeDatabase, closePool } from './db.js';
import { healthRouter } from './routes/health.js';
import { replaysRouter } from './routes/replays.js';
import { testProgressRouter } from './routes/test-progress.js';
import { adminRouter } from './routes/admin.js';

const PORT = Number(process.env.PORT ?? 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

function parseCorsOrigins(raw: string): string[] | true {
  if (raw === '*') return true;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  console.log('[server] starting v2.2.0-alpha.0...');
  console.log(`[server] PORT=${PORT} CORS_ORIGIN=${CORS_ORIGIN}`);

  // 1. 初始化数据库（建 DB + 建表 + 81 行种子）
  try {
    await initializeDatabase();
    console.log('[server] ✅ database initialized');
  } catch (err) {
    console.error('[server] ❌ database initialization failed:', err);
    process.exit(1);
  }

  // 2. 创建 Express app
  const app = express();

  // 3. CORS 白名单
  const corsOptions: cors.CorsOptions = {
    origin: parseCorsOrigins(CORS_ORIGIN),
    methods: ['GET', 'POST'],
    credentials: false,
  };
  app.use(cors(corsOptions));

  // 4. JSON 解析（限制 1MB，replay JSON 一般 30-80KB，留余量）
  app.use(express.json({ limit: '1mb' }));

  // 5. 请求日志（开发期用）
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // 6. 路由
  app.use('/api', healthRouter);
  app.use('/api', replaysRouter);
  app.use('/api', testProgressRouter);
  app.use('/api', adminRouter);  // v2.2.1.4: admin 鉴权 + 录像下载

  // 7. 404
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: 'Not Found' });
  });

  // 8. 全局错误处理
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] unhandled error:', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Internal Server Error',
    });
  });

  // 9. 启动监听
  app.listen(PORT, () => {
    console.log(`[server] ✅ listening on http://localhost:${PORT}`);
    console.log(`[server]    GET  /api/health`);
    console.log(`[server]    POST /api/replays`);
    console.log(`[server]    GET  /api/replays/stats`);
    console.log(`[server]    GET  /api/test-progress`);
    console.log(`[server]    POST /api/test-progress/increment`);
    console.log(`[server]    POST /api/test-progress/reset`);
    console.log(`[server]    POST /api/test-progress/select-random`);
    console.log(`[server]    GET  /api/admin/replays (X-Admin-Token)`);
    console.log(`[server]    GET  /api/admin/stats    (X-Admin-Token)`);
  });

  // 10. 优雅退出
  const shutdown = async (signal: string) => {
    console.log(`[server] received ${signal}, shutting down...`);
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] fatal error:', err);
  process.exit(1);
});
