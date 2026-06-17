// React hook — 封装 wsService，供组件消费
// handler 在 mount 时设置，unmount 时不清除以支持 Lobby→LANGame 无缝过渡

import { useCallback, useEffect, useRef, useState } from 'react';
import { wsService } from '../services/websocketService';
import type { ServerMessage, ClientMessage } from '../types/network';

interface UseWSConnectionReturn {
  send: (msg: ClientMessage) => boolean;
  isConnected: boolean;
  connect: (url: string, opts?: { autoReconnect?: boolean }) => void;
  disconnect: () => void;
}

export function useWSConnection(
  handler: ((msg: ServerMessage) => void) | null
): UseWSConnectionReturn {
  const [isConnected, setIsConnected] = useState(wsService.isConnected);

  // 稳定引用确保 send/connect/disconnect 的 useCallback 稳定
  const sendRef = useRef(wsService.send.bind(wsService));
  sendRef.current = wsService.send.bind(wsService);

  // 订阅连接状态
  useEffect(() => {
    const unsub = wsService.onConnectionChange(setIsConnected);
    return unsub;
  }, []);

  // 设置消息处理器（unmount 时不清除，下一个组件接管）
  useEffect(() => {
    wsService.setHandler(handler);
  }, [handler]);

  const send = useCallback((msg: ClientMessage) => sendRef.current(msg), []);
  const connect = useCallback(
    (url: string, opts?: { autoReconnect?: boolean }) => wsService.connect(url, opts),
    [],
  );
  const disconnect = useCallback(() => wsService.disconnect(), []);

  return { send, isConnected, connect, disconnect };
}
