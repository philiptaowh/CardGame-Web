// v2.2.1.4 - admin API 纯逻辑 smoke test
//
// 不依赖 MySQL, 验证:
//   - 时间范围参数解析
//   - limit/offset 边界
//   - ADMIN_TOKEN 缺失/错误/正确时的鉴权分支
//   - 响应结构完整性

import { strict as assert } from 'node:assert';

// 复制 routes/admin.ts 里的纯函数（保持同步）
type QueryParams = {
  since?: string;
  until?: string;
  limit?: string;
  offset?: string;
};

type ParsedParams = {
  since: string;
  until: string;
  limit: number;
  offset: number;
};

function parseQueryParams(query: QueryParams): ParsedParams {
  const since = query.since || '1970-01-01';
  const until = query.until || '2099-12-31';
  const limit = Math.min(Number(query.limit ?? 100) || 100, 10000);
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
  return { since, until, limit, offset };
}

function checkAdminAuth(headers: Record<string, any>, expectedToken: string | undefined): {
  ok: boolean;
  status: number;
  error?: string;
} {
  if (!expectedToken) {
    return { ok: false, status: 500, error: 'ADMIN_TOKEN 未配置' };
  }
  const provided = headers['x-admin-token'];
  if (typeof provided !== 'string' || provided !== expectedToken) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, status: 200 };
}

function formatReplaysResponse(
  rows: Array<{ id: number; char_player: string; char_ai: string; payload: any }>,
  total: number,
  limit: number,
  offset: number,
): { ok: boolean; data: any[]; total: number; limit: number; offset: number } {
  const data = rows.map((r) => ({
    id: r.id,
    char_player: r.char_player,
    char_ai: r.char_ai,
    payload: typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload),
  }));
  return { ok: true, data, total, limit, offset };
}

// ============ 测试用例 ============

// 1) parseQueryParams 默认值
{
  const p = parseQueryParams({});
  assert.equal(p.since, '1970-01-01');
  assert.equal(p.until, '2099-12-31');
  assert.equal(p.limit, 100);
  assert.equal(p.offset, 0);
  console.log('✅ parseQueryParams 默认值正确');
}

// 2) parseQueryParams 显式参数
{
  const p = parseQueryParams({
    since: '2026-06-01', until: '2026-07-01', limit: '500', offset: '100',
  });
  assert.equal(p.since, '2026-06-01');
  assert.equal(p.until, '2026-07-01');
  assert.equal(p.limit, 500);
  assert.equal(p.offset, 100);
  console.log('✅ parseQueryParams 显式参数解析正确');
}

// 3) parseQueryParams limit 上限保护 (10000)
{
  const p = parseQueryParams({ limit: '99999' });
  assert.equal(p.limit, 10000, 'limit 应该被截到 10000');
  console.log('✅ limit 超过 10000 截断到 10000');
}

// 4) parseQueryParams limit 非数字降级
{
  const p = parseQueryParams({ limit: 'abc' });
  assert.equal(p.limit, 100, '非数字应降级为默认 100');
  console.log('✅ limit 非数字降级为 100');
}

// 5) parseQueryParams offset 负数
{
  const p = parseQueryParams({ offset: '-5' });
  assert.equal(p.offset, 0, '负数应 clamp 到 0');
  console.log('✅ offset 负数 clamp 到 0');
}

// 6) checkAdminAuth 缺失 token (服务器未配)
{
  const r = checkAdminAuth({}, undefined);
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
  console.log('✅ ADMIN_TOKEN 未配置 → 500');
}

// 7) checkAdminAuth 缺失 header
{
  const r = checkAdminAuth({}, 'secret');
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
  console.log('✅ 缺 X-Admin-Token header → 401');
}

// 8) checkAdminAuth 错误 token
{
  const r = checkAdminAuth({ 'x-admin-token': 'wrong' }, 'secret');
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
  console.log('✅ X-Admin-Token 错误 → 401');
}

// 9) checkAdminAuth 正确 token
{
  const r = checkAdminAuth({ 'x-admin-token': 'secret' }, 'secret');
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  console.log('✅ X-Admin-Token 正确 → 200');
}

// 10) formatReplaysResponse 响应结构
{
  const rows = [
    { id: 1, char_player: 'char_1', char_ai: 'char_3', payload: '{"config":{}}' },
    { id: 2, char_player: 'char_5', char_ai: 'char_7', payload: { foo: 'bar' } },
  ];
  const r = formatReplaysResponse(rows, 2, 100, 0);
  assert.equal(r.ok, true);
  assert.equal(r.data.length, 2);
  assert.equal(r.total, 2);
  assert.equal(r.data[0].payload, '{"config":{}}', 'string payload 保持原样');
  assert.equal(r.data[1].payload, '{"foo":"bar"}', 'object payload 序列化为 JSON');
  console.log('✅ formatReplaysResponse 响应结构 + payload 类型处理正确');
}

// 11) 端到端模拟: parse → auth → format
{
  // 模拟客户端不带 token 请求
  const params = parseQueryParams({ since: '2026-06-01' });
  const auth1 = checkAdminAuth({}, 'correct-token');
  assert.equal(auth1.ok, false);

  // 模拟客户端带正确 token 请求
  const auth2 = checkAdminAuth({ 'x-admin-token': 'correct-token' }, 'correct-token');
  assert.equal(auth2.ok, true);

  // 模拟响应
  const rows = [
    { id: 1, char_player: 'char_1', char_ai: 'char_3', payload: '{}' },
  ];
  const r = formatReplaysResponse(rows, 1, params.limit, params.offset);
  assert.equal(r.data[0].char_player, 'char_1');
  console.log('✅ 端到端 鉴权+参数+响应 流程正常');
}

console.log('\n🎉 all admin smoke tests passed');
