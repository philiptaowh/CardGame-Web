const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const server = require('./server.cjs');

// ============ 录制数据落盘（v1.3.0 测试版）============
//
// 策略：所有录制文件（Replay JSONL + test-progress.json）都写到
// EXE 所在目录的 replays/ 子目录。NSIS 安装到非系统盘时，玩家可以直接
// 把这个文件夹打包回传给开发者。
//
// 注意：不要写到 app.getPath('userData')，因为那跟着系统盘走，玩家
// 很难找；也不要写到 Downloads，会和系统其他下载混在一起。

const REPLAYS_SUBDIR = 'replays';

/**
 * 计算并按需创建 replays/ 目录。返回绝对路径。
 * 如果父目录不可写（例如 NSIS 装到了 C:\Program Files\），
 * fs.mkdirSync 会抛 EACCES / EPERM，被 caller 捕获后向 UI 返回错误。
 */
function resolveReplaysDir() {
  // app.getPath('exe') 在 packaged 模式下是 EXE 绝对路径
  const exeDir = path.dirname(app.getPath('exe'));
  const dir = path.join(exeDir, REPLAYS_SUBDIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 校验并规范化文件名，禁止任何路径分隔符/上级引用
 * 只允许 base name + 可选后缀（.jsonl / .json）
 */
function sanitizeFilename(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('filename 必须是非空字符串');
  }
  // path.basename 会把 '..' '/' '\' 全部剥掉，得到最末段
  const base = path.basename(raw);
  if (base !== raw) {
    throw new Error(`filename 包含非法路径分隔符: ${raw}`);
  }
  if (base.length > 200) {
    throw new Error('filename 过长（>200 字符）');
  }
  if (!/^[\w\-\.一-龥]+$/.test(base)) {
    throw new Error(`filename 含非法字符: ${raw}`);
  }
  return base;
}

let win = null;
let tray = null;
let isQuitting = false;

// ============ 窗口 ============

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: '卡牌游戏 v1.3.0-test',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.loadFile(path.join(__dirname, '../dist/index.html'));

  win.on('close', (event) => {
    if (!isQuitting && server.isRunning()) {
      event.preventDefault();
      win.hide();
      createTray();
    }
  });
}

// ============ 系统托盘 ============

function createTray() {
  if (tray) return;
  try {
    // 16x16 绿色图标 (base64 PNG)
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2NkYPj/n4EBBZgYKAQMDAz/GYpWk2J4QUEQkgY8QMNpCkxUMpyGqUqG4QAAJ8UIEQrLG4oAAAAASUVORK5CYII='
    );
    tray = new Tray(icon);
    const ctxMenu = Menu.buildFromTemplate([
      {
        label: '显示窗口',
        click: () => {
          if (win) { win.show(); win.focus(); }
          destroyTray();
        },
      },
      { type: 'separator' },
      {
        label: '关闭服务器',
        click: () => {
          const count = server.getPlayerCount();
          const result = dialog.showMessageBoxSync({
            type: 'warning',
            buttons: ['取消', '确认关闭'],
            defaultId: 0,
            title: '关闭服务器',
            message: `还有 ${count} 名玩家在线`,
            detail: count > 0
              ? '所有玩家将断开连接，确定关闭服务器吗？'
              : '当前没有玩家在线，确定关闭服务器吗？',
          });
          if (result === 1) {
            server.stop();
            destroyTray();
            app.quit();
          }
        },
      },
    ]);
    tray.setToolTip('卡牌游戏 - 服务器运行中');
    tray.setContextMenu(ctxMenu);
  } catch (e) {
    console.log('[Main] Tray not available:', e.message);
  }
}

function destroyTray() {
  if (tray) { tray.destroy(); tray = null; }
}

// ============ IPC ============

ipcMain.handle('start-server', async () => {
  try {
    const info = await server.start(0);
    return info;
  } catch (err) {
    console.error('[Main] Failed to start server:', err);
    throw err;
  }
});

ipcMain.on('stop-server', () => {
  server.stop();
});

ipcMain.on('quit-app', () => {
  isQuitting = true;
  server.stop();
  destroyTray();
  app.quit();
});

// ============ 应用生命周期 ============

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (server.isRunning()) {
    // Server should keep running, do nothing here
    return;
  }
  app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  server.stop();
  destroyTray();
});

// ============ 录制数据落盘 IPC（v1.3.0 测试版）============

ipcMain.handle('replay:get-dir', async () => {
  try {
    return resolveReplaysDir();
  } catch (err) {
    console.error('[Main] resolveReplaysDir failed:', err);
    throw err;
  }
});

ipcMain.handle('replay:write', async (_event, filename, content) => {
  try {
    const dir = resolveReplaysDir();
    const safe = sanitizeFilename(filename);
    const full = path.join(dir, safe);
    // 防御性检查：resolved path 必须在 dir 之内（防 symlink 攻击）
    if (!full.startsWith(dir + path.sep) && full !== dir) {
      return { ok: false, error: `路径校验失败: ${safe}` };
    }
    fs.writeFileSync(full, content, 'utf8');
    return { ok: true, path: full };
  } catch (err) {
    console.error('[Main] replay:write failed:', err);
    return { ok: false, error: formatFsError(err) };
  }
});

ipcMain.handle('replay:write-test-progress', async (_event, filename, content) => {
  try {
    const dir = resolveReplaysDir();
    const safe = sanitizeFilename(filename);
    const full = path.join(dir, safe);
    if (!full.startsWith(dir + path.sep) && full !== dir) {
      return { ok: false, error: `路径校验失败: ${safe}` };
    }
    fs.writeFileSync(full, content, 'utf8');
    return { ok: true, path: full };
  } catch (err) {
    console.error('[Main] replay:write-test-progress failed:', err);
    return { ok: false, error: formatFsError(err) };
  }
});

ipcMain.handle('replay:open-dir', async () => {
  try {
    const dir = resolveReplaysDir();
    // openPath 在 Windows 上会调用 explorer.exe
    await shell.openPath(dir);
  } catch (err) {
    console.error('[Main] replay:open-dir failed:', err);
    throw err;
  }
});

/**
 * 把 errno 翻译成对玩家友好的中文提示
 */
function formatFsError(err) {
  if (!err) return '未知错误';
  const code = err.code || '';
  if (code === 'EACCES' || code === 'EPERM') {
    return '没有写权限。请不要把游戏安装到 C:\\Program Files 等系统目录。';
  }
  if (code === 'ENOSPC') {
    return '磁盘空间不足';
  }
  if (code === 'ENOENT') {
    return '目标目录不存在或无法创建';
  }
  return `${code || 'FS_ERROR'}: ${err.message || String(err)}`;
}
