// 局域网联机网络协议类型定义

import type { CharacterId, Card, Skill } from './index';

// ============ 房间玩家 ============

export interface RoomPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  phase: RoomPhase;
  players: RoomPlayer[];
  settings: {
    maxPlayers: number;
  };
}

export type RoomPhase =
  | 'idle'            // 房间未创建
  | 'lobby'           // 等待中
  | 'char_select'     // 角色选择
  | 'card_exchange'   // 换牌
  | 'phase1'          // 能量放置
  | 'phase2'          // 行动阶段
  | 'phase3'          // 印记结算
  | 'ended';          // 游戏结束（房间保留/清空判断）

// ============ 角色选择 ============

export interface CharSelection {
  playerId: string;
  characterId: CharacterId | null;
  confirmed: boolean;
}

// ============ WebSocket 消息协议 ============

// 客户端 → 服务端
export type ClientMessage =
  | { type: 'join'; nickname: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'leave' }
  | { type: 'start_game' }
  // 角色选择
  | { type: 'char_select'; characterId: CharacterId | null }
  | { type: 'char_confirm' }
  // 换牌
  | { type: 'exchange_card'; cardIndex: number }
  | { type: 'exchange_done' }
  // 阶段1 能量
  | { type: 'place_energy'; cardIndices: number[] }
  | { type: 'energy_done' }
  // 阶段2 行动
  | { type: 'use_skill'; skillIndex: number; targetId: string; paymentCardIndices: number[] }
  | { type: 'use_special_card'; cardIndex: number; targetId?: string }
  | { type: 'end_action' }
  // 观战
  | { type: 'spectate' }
  // 游戏状态同步（房主 → 服务端）
  | { type: 'sync_game_state'; state: any }
  // 时间银行（房主 → 服务端）
  | { type: 'init_time_bank'; playerIds: string[]; currentPlayerId: string }
  // 换回合 phase 重置（房主 → 服务端，endTurn 后重置 roomState.phase 为 phase1）
  | { type: 'reset_phase' }
  // 客户端日志转发到服务端终端
  | { type: 'client_log'; message: string };

// 服务端 → 客户端
export type ServerMessage =
  // 连接/房间
  | { type: 'welcome'; playerId: string; roomState: RoomState }
  | { type: 'room_update'; roomState: RoomState }
  | { type: 'player_joined'; player: RoomPlayer }
  | { type: 'player_left'; playerId: string }
  | { type: 'player_disconnected'; playerId: string }
  | { type: 'player_ready'; playerId: string; ready: boolean }
  // 游戏状态
  | { type: 'game_start'; charSelections: CharSelection[] }
  | { type: 'char_update'; selections: CharSelection[] }
  | { type: 'timer'; phase: string; remaining: number }
  | { type: 'game_state_update'; state: any }  // 服务端新状态
  | { type: 'time_bank'; playerId: string; remaining: number }
  | { type: 'turn_change'; playerId: string }
  // 错误/系统
  | { type: 'error'; message: string }
  | { type: 'kicked'; reason: string }
  // 游戏状态同步（服务端 → 客户端）
  | { type: 'sync_game_state'; state: any }
  // 游戏结束
  | { type: 'game_over'; winner: { id: string; name: string } | null }
  // 时间银行
  | { type: 'time_expired'; playerId: string }
  // 服务端中继的玩家行动消息（带有 fromPlayerId）
  | { type: 'use_skill'; skillIndex: number; targetId: string; paymentCardIndices: number[]; fromPlayerId: string }
  | { type: 'use_special_card'; cardIndex: number; targetId?: string; fromPlayerId: string }
  | { type: 'end_action'; fromPlayerId: string }
  | { type: 'exchange_card'; cardIndex: number; fromPlayerId: string }
  | { type: 'place_energy'; cardIndices: number[]; fromPlayerId: string };

// Electron IPC (主进程 ↔ 渲染进程)
export interface ServerInfo {
  port: number;
  ip: string;
}

export interface ElectronAPI {
  quitApp: () => void;
  startServer: () => Promise<ServerInfo>;
  stopServer: () => void;
  onServerStarted: (callback: (info: ServerInfo) => void) => void;
  onServerStopped: (callback: () => void) => void;
  removeServerStarted: () => void;
  removeServerStopped: () => void;
}
