// Replay 导出服务
//
// 把 V1Replay 序列化为单行 JSONL。
// 输出方式取决于运行环境：
//   - Electron 打包版：走 IPC，由 main 进程写到 EXE 所在目录的 replays/
//     子目录（玩家可以直接把这个文件夹打包回传）
//   - 浏览器开发版（vite dev）：保持 Blob + a.click 触发浏览器下载
//   - v2.2.0-alpha 网页版：POST 到 Node 后端 /api/replays（uploadReplayToServer）
//
// 文件名格式：replay_YYYYMMDD_HHMMSS_1v1_charX_vs_charY_seedN.jsonl
//
// 该格式与 V2 simulator 输出的 Replay JSONL 兼容（V2 直接 JSON.stringify(Replay)）
// Phase 2 的 tools/parse_human_replays.py 可直接解析

import type { V1Replay } from '../stores/replayStore';
import { apiUrl } from '../config/buildMode';

/** 统一返回：成功含 path，失败含可向用户展示的错误信息 */
export type ReplayExportResult = {
  ok: boolean;
  /** Electron 模式下是文件系统绝对路径；浏览器模式下是触发下载的文件名；上传模式下是 server 返回的 id */
  path?: string;
  /** 错误信息（仅 ok=false 时存在） */
  error?: string;
};

/** 格式化文件名时间戳 YYYYMMDD_HHMMSS */
function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

/** 生成导出文件名 */
export function generateReplayFilename(replay: V1Replay): string {
  const ts = formatTimestamp(replay.timestamp);
  const { humanCharId, aiCharId } = replay.config;
  return `replay_${ts}_1v1_${humanCharId}_vs_${aiCharId}_seed${replay.seed}.jsonl`;
}

/** 序列化 Replay 为单行 JSON 字符串
 *
 * 重要：必须是单行（无换行符），符合 JSON Lines 规范
 * V2 simulator 内部用 JSON.stringify(Replay) 也是单行
 */
export function serializeReplayAsJSONL(replay: V1Replay): string {
  return JSON.stringify(replay);
}

/** 判断当前是否在 Electron 打包环境内 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.writeReplay;
}

/**
 * 导出 Replay。
 *
 * - Electron 模式：await IPC 写文件，返回绝对路径
 * - 浏览器模式：触发 a.click 下载，返回 { ok: true, path: <filename> }
 *
 * 调用方应 await，并基于 ok/error 决定显示成功/失败 toast。
 */
export async function exportReplayAsJSONL(replay: V1Replay): Promise<ReplayExportResult> {
  const jsonl = serializeReplayAsJSONL(replay);
  const filename = generateReplayFilename(replay);

  if (isElectron()) {
    // 走 IPC，由 main 进程写盘
    try {
      const result = await window.electronAPI!.writeReplay(filename, jsonl);
      return result;
    } catch (err) {
      return {
        ok: false,
        error: `IPC 调用失败: ${(err as Error)?.message ?? String(err)}`,
      };
    }
  }

  // 浏览器降级路径：Blob + a.click
  try {
    const blob = new Blob([jsonl], { type: 'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, path: filename };
  } catch (err) {
    return {
      ok: false,
      error: `浏览器下载失败: ${(err as Error)?.message ?? String(err)}`,
    };
  }
}

/**
 * v2.2.0-alpha 网页版：上传 Replay 到 Node 后端。
 *
 * POST `${API_BASE}/api/replays`，body 为完整 V1Replay JSON 对象（非 JSONL 单行）。
 * 超时 10s。失败原因包含网络/CORS/服务端 5xx 等。
 *
 * 返回：成功 {ok: true, path: <server-id>}; 失败 {ok: false, error: <message>}
 *
 * 调用方应将失败时把 replay 入 pendingUploads 队列，等下次启动重试。
 */
export async function uploadReplayToServer(replay: V1Replay): Promise<ReplayExportResult> {
  const url = apiUrl('/api/replays');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replay),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // 服务端错误：尽量解析 error 字段
      let errorMsg = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) errorMsg = `${errorMsg}: ${body.error}`;
      } catch {
        // 响应非 JSON
      }
      return { ok: false, error: errorMsg };
    }

    // 解析服务端返回 id
    let serverId: string | undefined;
    try {
      const body = (await res.json()) as { id?: number | string };
      if (body.id !== undefined) serverId = String(body.id);
    } catch {
      // 响应非 JSON 也不致命
    }
    return { ok: true, path: serverId };
  } catch (err) {
    clearTimeout(timeoutId);
    const e = err as Error;
    if (e.name === 'AbortError') {
      return { ok: false, error: '上传超时 (10s)' };
    }
    return { ok: false, error: `网络错误: ${e?.message ?? String(err)}` };
  }
}

/** v2.2.0-alpha: 批量上传待上传队列（FIFO），全部成功才返回 ok */
export async function flushPendingUploads(
  replays: V1Replay[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: boolean; success: number; failed: number; lastError?: string }> {
  let success = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (let i = 0; i < replays.length; i++) {
    const r = replays[i];
    const result = await uploadReplayToServer(r);
    if (result.ok) {
      success++;
    } else {
      failed++;
      lastError = result.error;
    }
    onProgress?.(i + 1, replays.length);
    // 一旦失败立刻停止（保留队列等下次再试）
    if (!result.ok) break;
  }

  return { ok: failed === 0, success, failed, lastError };
}
