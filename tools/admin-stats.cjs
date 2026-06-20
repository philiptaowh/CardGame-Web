#!/usr/bin/env node
// ============================================================
// card-game admin 统计查看脚本 (v2.2.1.10)
// ============================================================
// 用途：admin 通过脚本查看服务端统计（录像 + 测试进度）
//       替代前端 UI 不提供的全局诊断视图
//
// 用法：
//   1. 准备环境变量：
//        export API="https://card.example.com"   # 默认
//        export ADMIN_TOKEN="<服务器 .env 里的 token>"  # 必填
//   2. 运行：
//        node tools/admin-stats.cjs
//
// 显示：
//   - 录像总数 / 时间范围
//   - 各 char_ai × winner 胜率
//   - 测试进度（不需鉴权，从 /api/test-progress 拿）
// ============================================================

'use strict';

const API = process.env.API || 'https://card.example.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function printHelp() {
  console.log(`
用法: node tools/admin-stats.cjs

环境变量（必填）:
  ADMIN_TOKEN   服务器 .env 里的 admin API token

环境变量（可选）:
  API           admin API base URL（默认 https://card.example.com）
`);
  process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
}

// ============ 工具 ============

async function fetchAdminStats() {
  if (!ADMIN_TOKEN) {
    throw new Error('ADMIN_TOKEN 未设置（请：export ADMIN_TOKEN="..."）');
  }
  const url = `${API}/api/admin/stats`;
  const res = await fetch(url, { headers: { 'X-Admin-Token': ADMIN_TOKEN } });
  if (res.status === 401) throw new Error('Unauthorized: ADMIN_TOKEN 错误');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function fetchProgress() {
  const url = `${API}/api/test-progress`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ============ 主流程 ============

(async () => {
  console.log('📊  Card Game Admin 统计');
  console.log(`   API:  ${API}`);
  console.log(`   Token: ${ADMIN_TOKEN ? '✓ 已配置（' + ADMIN_TOKEN.length + ' 字符）' : '✗ 未配置'}`);
  console.log('');

  // 1. 录像统计（需鉴权）
  console.log('━━━ 录像统计（admin） ━━━');
  try {
    const stats = await fetchAdminStats();
    const t = stats.totals ?? {};
    console.log(`   总录像:   ${t.total ?? 0}`);
    console.log(`   首条时间: ${t.first_replay ?? '-'}`);
    console.log(`   末条时间: ${t.last_replay ?? '-'}`);
    console.log('');
    console.log('   按 char_ai × winner 分布:');
    const rows = stats.by_char_ai_winner ?? [];
    if (rows.length === 0) {
      console.log('     （无数据）');
    } else {
      // 按 char_ai 分组
      const byChar = {};
      for (const r of rows) {
        if (!byChar[r.char_ai]) byChar[r.char_ai] = { player: 0, ai: 0, draw: 0 };
        byChar[r.char_ai][r.winner] = (byChar[r.char_ai][r.winner] || 0) + r.count;
      }
      for (const [ch, wins] of Object.entries(byChar).sort()) {
        const total = wins.player + wins.ai + wins.draw;
        const pw = ((wins.player / total) * 100).toFixed(1);
        const aw = ((wins.ai / total) * 100).toFixed(1);
        console.log(`     ${ch}: 玩家 ${wins.player} 局 (${pw}%) | AI ${wins.ai} 局 (${aw}%) | 平局 ${wins.draw} 局`);
      }
    }
  } catch (err) {
    console.error(`   ❌ ${err.message}`);
  }
  console.log('');

  // 2. 测试进度（不需鉴权）
  console.log('━━━ 测试进度（公开） ━━━');
  try {
    const progress = await fetchProgress();
    const data = progress.data ?? {};
    console.log(`   总进度: ${data.completed ?? '?'}/${data.target ?? '?'}`);
    console.log(`   已锁定: ${data.locked ?? '?'} / ${data.available + data.locked ?? '?'}`);
  } catch (err) {
    console.error(`   ❌ ${err.message}`);
  }
  console.log('');

  console.log('💡 重置进度：admin 用 tools/admin-reset-progress.cjs --yes');
})();