// Electron preload 桥接的 window.electronAPI 类型声明
//
// 通过 contextBridge 在 preload.cjs 暴露给渲染端。
// 浏览器（vite dev）下该对象不存在，所有调用点须做 feature detection。

export {};

declare global {
  interface ElectronAPI {
    // ---- LAN server 控制（v1.2.0）----
    quitApp: () => void;
    startServer: () => Promise<unknown>;
    stopServer: () => void;
    onServerStarted: (cb: (info: unknown) => void) => void;
    onServerStopped: (cb: () => void) => void;
    removeServerStarted: () => void;
    removeServerStopped: () => void;

    // ---- 录制数据落盘（v1.3.0+ 测试版）----
    /**
     * 写一个 Replay JSONL 文件到 EXE 所在目录的 replays/ 子目录。
     * @returns ok=true 时 path 为绝对路径；ok=false 时 error 含可向用户展示的错误信息
     */
    writeReplay: (
      filename: string,
      content: string,
    ) => Promise<{ ok: boolean; path?: string; error?: string }>;

    /**
     * 同步测试进度 JSON 到同一 replays/ 目录。
     * filename 通常固定为 'test-progress.json'，但允许调用方自定义
     */
    writeTestProgress: (
      filename: string,
      content: string,
    ) => Promise<{ ok: boolean; path?: string; error?: string }>;

    /** 取得 EXE 所在目录的 replays/ 子目录绝对路径（自动创建）。 */
    getReplaysDir: () => Promise<string>;

    /** 用系统资源管理器打开 replays/ 目录。 */
    openReplaysDir: () => Promise<void>;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
