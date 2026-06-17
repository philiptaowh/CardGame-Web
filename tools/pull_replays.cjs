#!/usr/bin/env node
// ============================================================
// card-game 录像拉取脚本 (v2.2.1.4)
// ============================================================
// 用途：从服务端 admin API 拉取所有录像到本机 V1Replay JSONL
//       直接喂 V2 analysis/main.py 进行角色平衡分析
//
// 用法：
//   1. 准备环境变量：
//        export ADMIN_TOKEN="<服务器 .env 里的 token>"
//        export API="https://card.example.com/api/admin/replays"   # 可选, 有默认
//   2. 拉取：
//        node tools/pull_replays.cjs 2026-06-01 2099-12-31 ./downloads/all.jsonl
//        # 或 --help 看完整参数
//
// 输出格式：每行一个 V1Replay JSON 对象（与 V2 仿真 Replay 完全一致）
//   → analysis/main.py --input ./downloads/all.jsonl --gpu
// ============================================================

'use strict';

// ============ 参数解析 ============

function printHelp() {
  console.log(`
用法: node tools/pull_replays.cjs [since] [until] [output]

参数:
  since    ISO 日期 (默认 1970-01-01)
  until    ISO 日期 (默认 2099-12-31)
  output   输出 JSONL 文件路径 (默认 ./downloads/replays-<timestamp>.jsonl)

环境变量 (必填):
  ADMIN_TOKEN    从服务器 .env 复制的 admin API token

环境变量 (可选):
  API            admin API base URL (默认 https://card.example.com/api/admin/replays)
  PAGE_SIZE      每页条数 (默认 100, 上限 10000)

示例:
  export ADMIN_TOKEN="abc123..."
  node tools/pull_replays.cjs 2026-06-01 2099-12-31 ./downloads/2026.jsonl
  node tools/pull_replays.cjs  # 拉全部
  node tools/pull_replays.cjs --help
`);
  process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
}

const since = process.argv[2] || '1970-01-01';
const until = process.argv[3] || '2099-12-31';
const output = process.argv[4] || `./downloads/replays-${Date.now()}.jsonl`;

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const API = process.env.API || 'https://card.example.com/api/admin/replays';
const PAGE_SIZE = Number(process.env.PAGE_SIZE) || 100;

if (!ADMIN_TOKEN) {
  console.error('❌ 错误: ADMIN_TOKEN 环境变量未设置');
  console.error('   请: export ADMIN_TOKEN="<服务器 .env 里的 token>"');
  console.error('   提示: ssh deploy@<ECS-IP> "cat /home/deploy/New_Card_Game/card-game/server/.env | grep ADMIN_TOKEN"');
  process.exit(1);
}

// ============ 工具 ============

const fs = require('node:fs');
const path = require('node:path');

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function fetchPage(offset) {
  const url = `${API}?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, { headers: { 'X-Admin-Token': ADMIN_TOKEN } });
  if (res.status === 401) {
    throw new Error('Unauthorized: ADMIN_TOKEN 错误或缺失');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ============ 主流程 ============

(async () => {
  const t0 = Date.now();
  ensureDir(output);
  const ws = fs.createWriteStream(output);
  let total = 0;
  let offset = 0;
  let totalToFetch = Infinity;

  console.log(`🚀 开始拉取录像`);
  console.log(`   API:   ${API}`);
  console.log(`   时间:  ${since} ~ ${until}`);
  console.log(`   输出:  ${output}`);
  console.log(`   分页:  ${PAGE_SIZE} 条/页`);
  console.log('');

  while (offset < totalToFetch) {
    let body;
    try {
      body = await fetchPage(offset);
    } catch (err) {
      console.error(`❌ 第 ${offset / PAGE_SIZE + 1} 页拉取失败: ${err.message}`);
      ws.end();
      process.exit(1);
    }
    if (totalToFetch === Infinity) {
      totalToFetch = body.total;
      console.log(`📊 服务端总条数: ${totalToFetch}`);
    }
    if (body.data.length === 0) break;

    for (const row of body.data) {
      // row.payload 是 JSON 字符串, parse 后写为单行 (V1Replay JSONL)
      const replay = JSON.parse(row.payload);
      ws.write(JSON.stringify(replay) + '\n');
      total++;
    }

    process.stdout.write(`\r   已写入: ${total} / ${totalToFetch} (${((total / totalToFetch) * 100).toFixed(1)}%)`);
    offset += PAGE_SIZE;
    if (body.data.length < PAGE_SIZE) break;
  }

  ws.end();
  await new Promise((resolve) => ws.on('finish', resolve));

  const t1 = Date.now();
  const sizeMB = (fs.statSync(output).size / 1024 / 1024).toFixed(2);
  console.log('');
  console.log('');
  console.log(`✅ 完成: ${total} 局已写入 ${output}`);
  console.log(`⏱️  耗时: ${((t1 - t0) / 1000).toFixed(1)}s, 大小: ${sizeMB}MB`);
  console.log('');
  console.log('下一步:');
  console.log(`  python analysis/main.py --input ${output} --gpu`);
})();
