const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ---- LAN server 控制 ----
  quitApp: () => ipcRenderer.send('quit-app'),
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.send('stop-server'),
  onServerStarted: (callback) => {
    ipcRenderer.on('server-started', (_event, info) => callback(info));
  },
  onServerStopped: (callback) => {
    ipcRenderer.on('server-stopped', () => callback());
  },
  removeServerStarted: () => {
    ipcRenderer.removeAllListeners('server-started');
  },
  removeServerStopped: () => {
    ipcRenderer.removeAllListeners('server-stopped');
  },

  // ---- 录制数据落盘（v1.3.0 测试版）----
  writeReplay: (filename, content) =>
    ipcRenderer.invoke('replay:write', filename, content),
  writeTestProgress: (filename, content) =>
    ipcRenderer.invoke('replay:write-test-progress', filename, content),
  getReplaysDir: () => ipcRenderer.invoke('replay:get-dir'),
  openReplaysDir: () => ipcRenderer.invoke('replay:open-dir'),
});
