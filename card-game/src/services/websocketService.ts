// 模块级 WebSocket 单例 — 全应用共享一个连接，消除 Lobby→LANGame 断线重连
// 核心能力：单连接、handler 动态切换、连接状态通知、自动重连

type MessageHandler = (msg: any) => void;
type ConnectionCallback = (connected: boolean) => void;

let ws: WebSocket | null = null;
let currentHandler: MessageHandler | null = null;
let connectionListeners: Set<ConnectionCallback> = new Set();
let _isConnected = false;
let _autoReconnect = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUrl: string | null = null;

function notify(connected: boolean) {
  _isConnected = connected;
  for (const cb of connectionListeners) {
    try { cb(connected); } catch { /* guard */ }
  }
}

function scheduleReconnect() {
  if (!_autoReconnect || !pendingUrl || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (pendingUrl) doConnect(pendingUrl);
  }, 2000);
}

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function doConnect(url: string) {
  if (ws) {
    ws.onopen = null;
    ws.onclose = null;
    ws.onmessage = null;
    ws.onerror = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1000, 'Reconnect');
    }
    ws = null;
  }

  try {
    ws = new WebSocket(url);
    ws.onopen = () => {
      notify(true);
    };
    ws.onclose = (event) => {
      ws = null;
      notify(false);
      if (_autoReconnect && event.code !== 1000) {
        scheduleReconnect();
      }
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        currentHandler?.(msg);
      } catch (e) {
        console.warn('[WS] handler error:', e);
      }
    };
    ws.onerror = () => { /* onclose will fire next */ };
  } catch {
    if (_autoReconnect) scheduleReconnect();
  }
}

export const wsService = {
  /** 建立连接（或切换 URL 时重新连接） */
  connect(url: string, opts?: { autoReconnect?: boolean }): void {
    pendingUrl = url;
    _autoReconnect = opts?.autoReconnect ?? false;
    clearReconnect();
    doConnect(url);
  },

  /** 主动断开连接 */
  disconnect(): void {
    clearReconnect();
    pendingUrl = null;
    _autoReconnect = false;
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.close(1000, 'Manual disconnect');
      ws = null;
    }
    if (_isConnected) notify(false);
  },

  /** 发送消息（返回是否成功） */
  send(msg: any): boolean {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    console.warn('[WS] send failed — ws not open, state:', ws?.readyState);
    return false;
  },

  /** 设置/替换消息处理器（同一时间只有一个活跃处理器） */
  setHandler(handler: MessageHandler | null): void {
    currentHandler = handler;
  },

  get isConnected(): boolean {
    return _isConnected;
  },

  /** 订阅连接状态变化，返回取消订阅函数 */
  onConnectionChange(cb: ConnectionCallback): () => void {
    connectionListeners.add(cb);
    return () => { connectionListeners.delete(cb); };
  },
};
