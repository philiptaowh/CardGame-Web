// v2.2.0-alpha 后端 - MySQL 连接池 + 启动自动建表
//
// 职责：
//   1. 从 .env 读取连接信息，懒创建 mysql2/promise 连接池
//   2. 启动时跑 schema.sql 自动建表（IF NOT EXISTS，幂等）
//   3. 提供 query / execute 便捷方法
//   4. 提供 getPool() 供路由层使用

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pool: mysql.Pool | null = null;

/** 读取并缓存 MySQL 连接池（懒创建） */
export function getPool(): mysql.Pool {
  if (pool) return pool;

  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const database = process.env.DB_NAME ?? 'card_game';

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    charset: 'utf8mb4',
  });

  return pool;
}

/**
 * 启动时调用：
 *   1. 先无 database 连接，确保目标 DB 存在（CREATE DATABASE IF NOT EXISTS）
 *   2. 再用带 database 的池跑 schema.sql 建表
 *   3. v2.2.1.2: 若 test_progress 表为空，初始化 81 matchup（target=10）
 *
 * 这样首次启动时无需手动 CREATE DATABASE + 初始化数据。
 */
export async function initializeDatabase(): Promise<void> {
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const database = process.env.DB_NAME ?? 'card_game';

  // 1) 确保 database 存在
  const bootstrap = await mysql.createConnection({ host, port, user, password });
  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await bootstrap.end();
  }

  // 2) 跑 schema.sql 建表
  const schemaPath = join(__dirname, 'schema.sql');
  const schemaSql = readFileSync(schemaPath, 'utf-8');
  const conn = await getPool().getConnection();
  try {
    await conn.query(schemaSql);
  } finally {
    conn.release();
  }

  // 3) v2.2.1.2: 初始化 test_progress（若表为空则插入 81 行）
  await seedTestProgressIfEmpty();
}

/** v2.2.1.2: 若 test_progress 表为空, 插入 81 个 matchup 默认行 (target=10) */
async function seedTestProgressIfEmpty(): Promise<void> {
  const [rows] = await getPool().query<any[]>('SELECT COUNT(*) AS c FROM test_progress');
  const count = Number(rows[0]?.c ?? 0);
  if (count > 0) return;

  console.log('[db] test_progress is empty, seeding 81 default matchups...');
  const values: string[] = [];
  for (let h = 1; h <= 9; h++) {
    for (let a = 1; a <= 9; a++) {
      const human = `char_${h}`;
      const ai = `char_${a}`;
      const key = `${human}|${ai}`;
      values.push(`('${key}','${human}','${ai}',10,0,JSON_ARRAY())`);
    }
  }
  const sql = `
    INSERT INTO test_progress (matchup_key, human_char, ai_char, target, completed, completed_at)
    VALUES ${values.join(',')}
  `;
  await getPool().query(sql);
  console.log('[db] ✅ seeded 81 test_progress rows');
}

/** 健康检查用：执行 SELECT 1 验证连接可用 */
export async function pingDatabase(): Promise<boolean> {
  try {
    const [rows] = await getPool().query('SELECT 1 AS ok');
    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    console.error('[db] ping failed:', err);
    return false;
  }
}

/** 关闭连接池（用于优雅退出） */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
