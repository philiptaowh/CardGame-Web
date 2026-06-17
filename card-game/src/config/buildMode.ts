// 构建模式配置（v2.2.0-alpha 网页版引入）
//
// 单点判断当前运行模式：
//   - `desktop` (默认)：Vite dev server / Electron 桌面 EXE
//   - `web`：网页版（`vite build --mode web` 产物）
//
// 用法：
//   - UI 显隐：`if (isWebMode()) { /* 隐藏 LAN 入口 */ }`
//   - 后端地址：`fetch(\`${API_BASE}/api/health\`)`（web 模式指向远端 Node 后端）
//
// 触发条件：
//   - `npm run build:web` → vite --mode web → import.meta.env.MODE === 'web'
//   - `vite --mode web` dev server 同上
//
// 单点判断的好处：未来如果要加 `mobile` / `embed` 等模式，只改这里。

/** Vite 注入的运行模式（`vite --mode X` 设置） */
export type BuildMode = 'desktop' | 'web';

/** 当前构建模式（运行时只读） */
export const BUILD_MODE: BuildMode =
  import.meta.env.MODE === 'web' ? 'web' : 'desktop';

/** 当前是否运行在网页版（v2.2.0-alpha 技术探索分支） */
export function isWebMode(): boolean {
  return BUILD_MODE === 'web';
}

/**
 * 后端 API base URL
 * - web 模式：读 `VITE_API_BASE` 环境变量（如 `https://card.example.com`），默认相对路径 `/`
 * - desktop 模式：固定为相对路径 `/`（Electron 内置 server 或 vite dev server）
 *
 * 注意：API_BASE 末尾**不**带 `/api`，路由层自行拼接。
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

/** 完整 API 端点 URL（拼接 API_BASE + path） */
export function apiUrl(path: string): string {
  // path 必须以 `/` 开头
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE === '') return normalized;
  // 去除 API_BASE 末尾可能的 `/`，避免 `//api`
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  return `${base}${normalized}`;
}
