// 网络状态 Store — 存储 LAN 联机连接信息和 WebSocket 发送函数

import { create } from 'zustand';
import type { ClientMessage } from '../types/network';

export interface LANPlayerInfo {
  id: string;
  nickname: string;
  isHost: boolean;
}

export interface NetworkStore {
  mode: 'ai' | 'lan' | null;
  wsUrl: string;
  playerId: string | null;
  nickname: string;
  isHost: boolean;
  players: LANPlayerInfo[];
  sendMessage: ((msg: ClientMessage) => boolean) | null;
  // 时间银行（LAN 模式）
  lanTimeBank: { playerId: string; remaining: number } | null;
  lanCurrentTurnPlayerId: string | null;
  setLAN: (info: {
    wsUrl: string;
    playerId: string;
    nickname: string;
    isHost: boolean;
    players: LANPlayerInfo[];
  }) => void;
  setSendMessage: (fn: (msg: ClientMessage) => boolean) => void;
  setTimeBank: (info: { playerId: string; remaining: number } | null) => void;
  setCurrentTurnPlayerId: (playerId: string | null) => void;
  reset: () => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  mode: null,
  wsUrl: '',
  playerId: null,
  nickname: '',
  isHost: false,
  players: [],
  sendMessage: null,
  lanTimeBank: null,
  lanCurrentTurnPlayerId: null,
  setLAN: (info) => set({ mode: 'lan', ...info }),
  setSendMessage: (fn) => set({ sendMessage: fn }),
  setTimeBank: (info) => set({ lanTimeBank: info }),
  setCurrentTurnPlayerId: (playerId) => set({ lanCurrentTurnPlayerId: playerId }),
  reset: () => set({
    mode: null, wsUrl: '', playerId: null, nickname: '', isHost: false, players: [], sendMessage: null,
    lanTimeBank: null, lanCurrentTurnPlayerId: null,
  }),
}));
