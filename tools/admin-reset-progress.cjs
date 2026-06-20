#!/usr/bin/env node
// ============================================================
// card-game 测试进度重置脚本 (v2.2.1.10)
// ============================================================
// 用途：admin 通过脚本清空所有 81 matchup 的已完成局数
//       不再从前端 UI 提供入口（避免玩家误触 / 恶意清空）
//
// 用法：
//   1. 准备环境变量：
//        export API="https://card.example.com"   # 默认
//        # ADMIN_TOKEN 可选（未来若后端加鉴权则启用）
//        # export ADMIN_TOKEN="..."
//   2. 强制 --yes 防误触：
//        node tools/admin-reset-progress.cjs --yes
//
// 警告：
//   - 此操作清空所有登录此网站玩家的共享进度
//   - 不可撤销
//   - 需要显示状态确认后才会真正执行
// ============================================================

'use strict';

const API = process.env.API || 'https://card.example.com';

function printHelp() {
  console.log(`
用法: node tools/admin-reset-progress.cjs --yes

参数:
  --yes    强制确认（必须）

环境变量:
  API           admin API base URL（默认 https://card.example.com）
  ADMIN_TOKEN   （可选）X-Admin-Token，未来鉴权启用后需要
`);
  process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
}

// ============ 工具 ============

async function fetchStats() {
  const url = `${API}/api/test-progress`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function resetProgress() {
  const url = `${API}/api/test-progress/reset`;
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.ADMIN_TOKEN) {
    headers['X-Admin-Token'] = process.env.ADMIN_TOKEN;
  }
  const res = await fetch(url, { method: 'POST', headers, body: '{}' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ============ 主流程 ============

(async () => {
  // 1. 强制 --yes
  if (!process.argv.includes('--yes')) {
    console.error('❌ 缺少 --yes 标志');
    console.error('   此操作不可撤销，必须显式确认');
    console.error('   用法: node tools/admin-reset-progress.cjs --yes');
    process.exit(1);
  }

  console.log('🗑️  Card Game 测试进度重置工具');
  console.log(`   API:  ${API}`);
  console.log(`   Token: ${process.env.ADMIN_TOKEN ? '✓ 已配置' : '✗ 未配置（当前后端不要求）'}`);
  console.log('');

  // 2. 显示当前状态
  console.log('📊 当前状态:');
  try {
    const stats = await fetchStats();
    const data = stats.data ?? {};
    console.log(`   总进度: ${data.completed ?? '?'}/${data.target ?? '?'}`);
    console.log(`   已锁定: ${data.locked ?? '?'} 个 matchup`);
    console.log(`   可用:   ${data.available ?? '?'} 个 matchup`);
  } catch (err) {
    console.warn(`   ⚠️ 无法读取当前状态: ${err.message}`);
    console.warn('   （继续执行，但请确认 API 地址正确）');
  }
  console.log('');

  // 3. 提示
  console.log('🚨 准备执行重置');
  console.log('   - 清空 81 个 matchup 的 completed（保留 target=10）');
  console.log('   - 影响所有登录此网站玩家的共享进度');
  console.log('   - 操作不可撤销');
  console.log('');

  // 4. 执行
  try {
    console.log('🚀 正在重置...');
    const result = await resetProgress();
    if (result.ok) {
      console.log('✅ 重置成功');
      process.exit(0);
    } else {
      console.error('❌ 重置失败:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ 重置失败:', err.message);
    process.exit(1);
  }
})();