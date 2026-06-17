// v2.2.1.2 — 共享测试进度 Store (服务端同步版本)
//
// 架构变更：
//   - 旧: localStorage 持久化，每个用户独立
//   - 新: 全部进度保存在 Node + MySQL 后端，所有登录此网站的玩家共用
//
// 行为：
//   1. mount 时 fetchProgress() 拉服务端 81 matchup
//   2. TestPage 玩完一局后调 incrementMatchupAsync() 推送
//   3. TestPage 启动 5s 轮询（由 TestPage 启动，不由 store 管）
//   4. 锁定机制：completed >= target → 客户端 disabled + 服务端 409
//   5. 数据迁移：旧 localStorage 数据首次访问时弹窗合并到服务器

import { create } from 'zustand';
import type { CharacterId } from '../types';
import { apiUrl } from '../config/buildMode';

// ============ 类型定义 ============

export interface MatchupProgress {
  matchupKey: string;
  humanChar: CharacterId;
  aiChar: CharacterId;
  target: number;
  completed: number;
  status: 'available' | 'locked';
}

export interface TestProgressStats {
  total: number;
  locked: number;
  available: number;
  completed: number;
  target: number;
  remaining: number;
}

export type IncrementResult =
  | { ok: true; data: MatchupProgress }
  | { ok: false; error: string; code?: 'LOCKED' | 'ALL_LOCKED' | 'NETWORK' };

interface TestProgressStore {
  /** 81 个 matchup 的当前进度 */
  progress: Record<string, MatchupProgress>;
  /** 进度统计 */
  stats: TestProgressStats;
  /** 服务端 config (defaultTarget / version) */
  config: { defaultTarget: number; version: number };
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息（最近一次失败） */
  error: string | null;
  /** 上次同步时间戳 (Unix ms) */
  lastSyncedAt: number | null;

  // --- Actions ---

  /** 从服务端拉取全部 81 matchup */
  fetchProgress: () => Promise<boolean>;
  /** 玩完一局后推送：服务端原子 +1 */
  incrementMatchupAsync: (humanChar: CharacterId, aiChar: CharacterId) => Promise<IncrementResult>;
  /** 随机挑一个 available matchup（前端兜底用） */
  selectRandomMatchupAsync: () => Promise<MatchupProgress | null>;
  /** 清空所有 completed（保留 target） */
  resetAllAsync: () => Promise<boolean>;
  /** 拉最近一次同步时间 */
  getLastSyncedAt: () => number | null;
  /** 从旧 localStorage 一次性合并（取 max） */
  migrateFromLocalStorage: () => Promise<boolean>;
}

// ============ 工具 ============

const LEGACY_LS_KEY = 'card-game-test-progress';

interface LegacyLocalData {
  progress: Record<string, { completed: number; target: number; completedAt?: number[] }>;
  initialized: boolean;
}

function readLegacyLocalStorage(): LegacyLocalData | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(LEGACY_LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LegacyLocalData;
  } catch {
    return null;
  }
}

function clearLegacyLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LEGACY_LS_KEY);
}

// ============ Store 实现 ============

export const useTestProgressStore = create<TestProgressStore>((set, get) => ({
  progress: {},
  stats: {
    total: 0, locked: 0, available: 0,
    completed: 0, target: 0, remaining: 0,
  },
  config: { defaultTarget: 10, version: 1 },
  isLoading: false,
  error: null,
  lastSyncedAt: null,

  fetchProgress: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(apiUrl('/api/test-progress'));
      if (!res.ok) {
        const err = `HTTP ${res.status}`;
        set({ isLoading: false, error: err });
        return false;
      }
      const body = (await res.json()) as {
        ok: boolean;
        data: MatchupProgress[];
        stats: TestProgressStats;
        config: { defaultTarget: number; version: number };
      };
      if (!body.ok) {
        set({ isLoading: false, error: 'server returned ok=false' });
        return false;
      }
      // index by matchupKey
      const progress: Record<string, MatchupProgress> = {};
      for (const m of body.data) {
        progress[m.matchupKey] = m;
      }
      set({
        progress,
        stats: body.stats,
        config: body.config,
        isLoading: false,
        error: null,
        lastSyncedAt: Date.now(),
      });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: `网络错误: ${(err as Error)?.message ?? String(err)}`,
      });
      return false;
    }
  },

  incrementMatchupAsync: async (humanChar, aiChar) => {
    try {
      const res = await fetch(apiUrl('/api/test-progress/increment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ humanChar, aiChar }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({})) as { error?: string; code?: string };
        return { ok: false, error: body.error ?? 'matchup 已锁定', code: (body.code as any) ?? 'LOCKED' };
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}`, code: 'NETWORK' };
      }
      const body = await res.json() as { ok: boolean; data?: MatchupProgress };
      if (!body.ok || !body.data) {
        return { ok: false, error: 'server ok=false', code: 'NETWORK' };
      }
      // 更新本地 progress
      const cur = get().progress;
      set({
        progress: { ...cur, [body.data.matchupKey]: body.data },
        lastSyncedAt: Date.now(),
      });
      // 同步重拉 stats（防止其它玩家也在改）
      get().fetchProgress();
      return { ok: true, data: body.data };
    } catch (err) {
      return {
        ok: false,
        error: `网络错误: ${(err as Error)?.message ?? String(err)}`,
        code: 'NETWORK',
      };
    }
  },

  selectRandomMatchupAsync: async () => {
    try {
      const res = await fetch(apiUrl('/api/test-progress/select-random'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        return null;
      }
      const body = await res.json() as { ok: boolean; data?: MatchupProgress };
      if (!body.ok || !body.data) return null;
      return body.data;
    } catch {
      return null;
    }
  },

  resetAllAsync: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(apiUrl('/api/test-progress/reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        set({ isLoading: false, error: `HTTP ${res.status}` });
        return false;
      }
      // 重新拉
      await get().fetchProgress();
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: `网络错误: ${(err as Error)?.message ?? String(err)}`,
      });
      return false;
    }
  },

  getLastSyncedAt: () => get().lastSyncedAt,

  migrateFromLocalStorage: async () => {
    const legacy = readLegacyLocalStorage();
    if (!legacy) return false; // 没有旧数据，无需迁移

    // 计算合并: 取 max(server.completed, legacy.completed) for each matchup
    const mergedUpdates: Array<{ key: string; addCount: number }> = [];
    for (const [key, legacyRow] of Object.entries(legacy.progress)) {
      const cur = get().progress[key];
      if (!cur) continue;
      const delta = (legacyRow.completed ?? 0) - cur.completed;
      if (delta > 0) {
        // 需要 +delta 次 increment
        for (let i = 0; i < delta; i++) {
          mergedUpdates.push({ key, addCount: 1 });
        }
      }
    }

    // 逐个调 increment（接受 race condition 409 失败，因为可能服务端已满）
    let successCount = 0;
    let failCount = 0;
    for (const u of mergedUpdates) {
      const [human, ai] = u.key.split('|') as [CharacterId, CharacterId];
      const result = await get().incrementMatchupAsync(human, ai);
      if (result.ok) successCount++;
      else failCount++;
    }

    // 清掉旧 localStorage
    clearLegacyLocalStorage();
    return successCount > 0 || failCount === 0;
  },
}));

// ============ 工具：用于 TestPage UI 显示 ============

/** 把进度映射到 10 格小方块 (■■■□□□□□□□) */
export function renderProgressBlocks(completed: number, target: number): string {
  const filled = '■'.repeat(Math.min(completed, target));
  const empty = '□'.repeat(Math.max(0, target - completed));
  return filled + empty;
}

/** 计算 next pending matchup（仅 available；按 AI BO 胜率降序） */
export function getNextPending(
  progress: Record<string, MatchupProgress>,
  aiBoWinrate: Record<CharacterId, number>,
): MatchupProgress | null {
  const available = Object.values(progress).filter(m => m.status === 'available');
  if (available.length === 0) return null;
  available.sort((a, b) => {
    const wa = aiBoWinrate[a.aiChar] ?? 0;
    const wb = aiBoWinrate[b.aiChar] ?? 0;
    if (wa !== wb) return wb - wa;
    return a.matchupKey.localeCompare(b.matchupKey);
  });
  return available[0];
}
