/// <reference types="vite/client" />

interface ServerInfo {
  port: number;
  ip: string;
}

interface ElectronAPI {
  quitApp: () => void;
  startServer: () => Promise<ServerInfo>;
  stopServer: () => void;
  onServerStarted: (callback: (info: ServerInfo) => void) => void;
  onServerStopped: (callback: () => void) => void;
  removeServerStarted: () => void;
  removeServerStopped: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
